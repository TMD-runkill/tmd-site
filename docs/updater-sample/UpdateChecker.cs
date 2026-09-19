// WinForms 檢查更新範例（.NET Framework 4.7.2+ 或 .NET 6+ 皆可）
// 用法：在主表單 Load 事件呼叫 await UpdateChecker.CheckAndPromptAsync("afk");
// 只依賴 System.Net.Http 與 System.Text.Json（.NET Framework 需 NuGet 安裝 System.Text.Json）。

using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

public static class UpdateChecker
{
    private const string SiteUrl = "https://tmd-run.netlify.app";
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

    public static async Task CheckAndPromptAsync(string product)
    {
        try
        {
            var json = await Http.GetStringAsync($"{SiteUrl}/api/latest?product={product}");
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
        var exePath = Application.ExecutablePath;
        var dir = Path.GetDirectoryName(exePath)!;
        string? newExe = null;

        foreach (var file in release.GetProperty("files").EnumerateArray())
        {
            var kind = file.GetProperty("kind").GetString();
            var url = file.GetProperty("url").GetString()!;
            var name = file.GetProperty("name").GetString()!;
            var sha = file.TryGetProperty("sha256", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;

            if (kind == "exe")
            {
                newExe = exePath + ".new";                 // 執行中的 exe 不能覆蓋，先下載成 .new
                await DownloadAsync(url, newExe, sha);
            }
            else if (kind == "config")
            {
                await DownloadAsync(url, Path.Combine(dir, name), sha);   // 設定檔只含預設值，直接覆蓋
            }
        }

        if (newExe == null) return;

        // 批次檔：等主程式結束 → 換檔 → 重新啟動
        var bat = Path.Combine(dir, "update.bat");
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
        var bytes = await Http.GetByteArrayAsync(url);   // /download/... 會 302 到 GitHub，HttpClient 自動跟隨

        if (!string.IsNullOrEmpty(expectedSha256))
        {
            using var sha = SHA256.Create();
            var actual = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
            if (actual != expectedSha256.ToLowerInvariant())
                throw new InvalidDataException($"{Path.GetFileName(target)} 檔案雜湊不符，下載可能損毀");
        }

        File.WriteAllBytes(target, bytes);
    }
}
