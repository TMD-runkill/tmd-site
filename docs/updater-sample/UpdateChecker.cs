// WinForms 檢查更新範例（.NET Framework 4.7.2+ 或 .NET 6+ 皆可）
// 用法：在主表單 Load 事件呼叫 await UpdateChecker.CheckAndPromptAsync("afk");
// 依賴 System.Net.Http、System.Text.Json、System.IO.Compression（.NET Framework 需 NuGet 安裝 System.Text.Json，
// 並加入 System.IO.Compression 與 System.IO.Compression.FileSystem 的參考）。
//
// Release 只有一個 zip，zip 根目錄直接是 exe 和 config.json（不能多包一層資料夾）。

using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

public static class UpdateChecker
{
    private const string SiteUrl = "https://tmd-run.netlify.app";

    // 逾時設長是為了下載大檔的 zip；查版本另外用 5 秒的 CancellationToken 限制，
    // 避免網站沒回應時卡住程式啟動。
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };

    public static async Task CheckAndPromptAsync(string product)
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var apiRes = await Http.GetAsync($"{SiteUrl}/api/latest?product={product}", cts.Token);
            apiRes.EnsureSuccessStatusCode();
            var json = await apiRes.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.GetProperty("status").GetString() != "released") return;

            var latest = Version.Parse(root.GetProperty("version").GetString());
            var current = Assembly.GetExecutingAssembly().GetName().Version;
            if (latest <= current) return;

            var notes = root.TryGetProperty("notes", out var n) ? n.GetString() : "";
            var answer = MessageBox.Show(
                $"發現新版本 V{latest}（目前 V{current}）\n\n{notes}\n\n是否立即更新？",
                "TMD 更新", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (answer != DialogResult.Yes) return;

            await DownloadAndRestartAsync(root);
        }
        catch
        {
            // 檢查更新失敗不影響使用，靜默略過
        }
    }

    private static async Task DownloadAndRestartAsync(JsonElement release)
    {
        // 找 zip
        JsonElement zip = default;
        foreach (var file in release.GetProperty("files").EnumerateArray())
        {
            if (file.GetProperty("kind").GetString() == "zip") { zip = file; break; }
        }
        if (zip.ValueKind == JsonValueKind.Undefined) return;

        var url = zip.GetProperty("url").GetString()!;
        var sha = zip.TryGetProperty("sha256", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;

        var exePath = Application.ExecutablePath;
        var exeName = Path.GetFileName(exePath);
        var appDir = Path.GetDirectoryName(exePath)!;

        // 1. 下載 zip 到暫存並比對 SHA256
        var tempDir = Path.Combine(Path.GetTempPath(), "tmd-update-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var zipPath = Path.Combine(tempDir, "update.zip");
        await DownloadAsync(url, zipPath, sha);

        // 2. 解壓到暫存
        var extractDir = Path.Combine(tempDir, "files");
        ZipFile.ExtractToDirectory(zipPath, extractDir);

        // 3. 把 zip 裡的檔案搬到程式資料夾：exe 存成 .new（執行中不能覆蓋），其他檔案直接覆蓋
        var newExe = exePath + ".new";
        foreach (var src in Directory.GetFiles(extractDir, "*", SearchOption.AllDirectories))
        {
            var rel = src.Substring(extractDir.Length + 1);
            var dest = rel.Equals(exeName, StringComparison.OrdinalIgnoreCase)
                ? newExe
                : Path.Combine(appDir, rel);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(src, dest, overwrite: true);
        }
        Directory.Delete(tempDir, recursive: true);

        if (!File.Exists(newExe)) return;   // zip 裡沒有同名 exe，只更新了其他檔案

        // 4. 批次檔：等主程式結束 → 換檔 → 重新啟動
        var bat = Path.Combine(appDir, "update.bat");
        File.WriteAllText(bat,
            "@echo off\r\n" +
            ":wait\r\n" +
            "timeout /t 1 /nobreak >nul\r\n" +
            $"del \"{exePath}\" 2>nul\r\n" +
            $"if exist \"{exePath}\" goto wait\r\n" +
            $"move /y \"{newExe}\" \"{exePath}\"\r\n" +
            $"start \"\" \"{exePath}\"\r\n" +
            "del \"%~f0\"\r\n");

        Process.Start(new ProcessStartInfo("cmd.exe", $"/c \"{bat}\"") { CreateNoWindow = true, UseShellExecute = false });
        Application.Exit();
    }

    private static async Task DownloadAsync(string url, string target, string? expectedSha256)
    {
        // /download/... 會 302 到 GitHub，HttpClient 自動跟隨。檔案大，用串流寫入避免整包放記憶體。
        using var response = await Http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        using (var input = await response.Content.ReadAsStreamAsync())
        using (var output = File.Create(target))
        {
            await input.CopyToAsync(output);
        }

        if (string.IsNullOrEmpty(expectedSha256)) return;

        using var sha = SHA256.Create();
        using var stream = File.OpenRead(target);
        var actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        if (actual != expectedSha256.ToLowerInvariant())
            throw new InvalidDataException("更新檔雜湊不符，下載可能損毀");
    }
}
