using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using Octgn.Core.DataExtensionMethods;
using Octgn.Core.DataManagers;
using Octgn.Core.Plugin;
using Octgn.DataNew;
using Octgn.DataNew.Entities;

namespace RanmaImageDownloader
{
    public sealed class RanmaImageDownloaderPlugin : IDeckBuilderPlugin
    {
        public static readonly Guid GameId = Guid.Parse("05ce00ff-544c-5fc1-81ca-387b109116d4");
        public IEnumerable<IPluginMenuItem> MenuItems => new[] { new RanmaImageDownloaderMenuItem() };
        public void OnLoad(GameManager games) { }
        public Guid Id => Guid.Parse("5ef7d342-faf2-4c71-aef1-0bbcb5af9f43");
        public string Name => "Ranma Card Game Image Downloader";
        public Version Version => Version.Parse("0.1.0.0");
        public Version RequiredByOctgnVersion => Version.Parse("3.1.240.0");
    }

    public sealed class RanmaImageDownloaderMenuItem : IPluginMenuItem
    {
        public string Name => "Ranma Card Game - Download Missing Images";

        public async void OnClick(IDeckBuilderPluginController controller)
        {
            try
            {
                var game = controller.GetLoadedGame();
                if (game == null || game.Id != RanmaImageDownloaderPlugin.GameId)
                    game = DbContext.Get().GameById(RanmaImageDownloaderPlugin.GameId);

                if (game == null)
                    throw new InvalidOperationException("Ranma Card Game is not installed in OCTGN.");

                var result = await ImageDownloader.DownloadMissingAsync(game);
                MessageBox.Show(
                    $"Downloaded {result.Downloaded} image(s).\n" +
                    $"Already installed: {result.Skipped}.\n" +
                    $"Unavailable/pending: {result.Pending}.\n" +
                    $"Failed: {result.Failed}.",
                    "Ranma Image Downloader", MessageBoxButton.OK,
                    result.Failed == 0 ? MessageBoxImage.Information : MessageBoxImage.Warning);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Ranma Image Downloader",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }

    internal static class ImageDownloader
    {
        private const string ManifestUrl =
            "https://raw.githubusercontent.com/JoePerry/Ranma/main/manifest.json";

        private static readonly HttpClient Client = CreateClient();

        private static HttpClient CreateClient()
        {
            var client = new HttpClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("OCTGN-Ranma-Image-Downloader/0.1");
            return client;
        }

        public static async Task<DownloadResult> DownloadMissingAsync(Game game)
        {
            var json = await Client.GetStringAsync(ManifestUrl);
            var manifest = new JavaScriptSerializer().Deserialize<Manifest>(json);

            if (!Guid.TryParse(manifest.gameGuid, out var manifestGameId) ||
                manifestGameId != RanmaImageDownloaderPlugin.GameId)
                throw new InvalidDataException("The image manifest is for a different OCTGN game.");

            var sets = game.Sets().ToDictionary(s => s.Id.ToString(), StringComparer.OrdinalIgnoreCase);
            var result = new DownloadResult();

            foreach (var image in manifest.images ?? new List<ManifestImage>())
            {
                if (!sets.TryGetValue(image.setGuid, out var set))
                {
                    result.Failed++;
                    continue;
                }

                Directory.CreateDirectory(set.ImagePackUri);
                var target = Path.Combine(set.ImagePackUri, image.cardGuid + ".jpg");

                if (File.Exists(target))
                {
                    result.Skipped++;
                    continue;
                }

                try
                {
                    var bytes = await Client.GetByteArrayAsync(image.url);
                    if (!String.IsNullOrWhiteSpace(image.sha256) &&
                        !String.Equals(Sha256(bytes), image.sha256, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Checksum mismatch for " + image.imageFile + ".");

                    File.WriteAllBytes(target, bytes);
                    result.Downloaded++;
                }
                catch
                {
                    result.Failed++;
                }
            }

            result.Pending = manifest.missingCount;
            return result;
        }

        private static string Sha256(byte[] bytes)
        {
            using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
        }
    }

    internal sealed class Manifest
    {
        public string gameGuid { get; set; }
        public int missingCount { get; set; }
        public List<ManifestImage> images { get; set; }
    }

    internal sealed class ManifestImage
    {
        public string imageFile { get; set; }
        public string cardGuid { get; set; }
        public string setGuid { get; set; }
        public string url { get; set; }
        public string sha256 { get; set; }
    }

    internal sealed class DownloadResult
    {
        public int Downloaded { get; set; }
        public int Skipped { get; set; }
        public int Pending { get; set; }
        public int Failed { get; set; }
    }
}
