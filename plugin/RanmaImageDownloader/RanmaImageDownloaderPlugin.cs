using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Controls;
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
        public Version Version => Version.Parse("0.2.7.0");
        public Version RequiredByOctgnVersion => Version.Parse("3.1.240.0");
    }

    public sealed class RanmaImageDownloaderMenuItem : IPluginMenuItem
    {
        public string Name => "Ranma Image Downloader";

        public async void OnClick(IDeckBuilderPluginController controller)
        {
            try
            {
                var game = controller.GetLoadedGame();
                if (game == null || game.Id != RanmaImageDownloaderPlugin.GameId)
                    game = DbContext.Get().GameById(RanmaImageDownloaderPlugin.GameId);
                if (game == null)
                    throw new InvalidOperationException("Ranma Card Game is not installed in OCTGN.");

                var catalog = await ImageDownloader.LoadCatalogAsync(game);
                new ImageDownloaderWindow(catalog).ShowDialog();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Image Downloader", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }

    internal sealed class ImageDownloaderWindow : Window
    {
        private readonly ImageCatalog _catalog;
        private readonly ListBox _sets;
        private readonly Button _updateSelected;
        private readonly Button _updateAll;
        private readonly TextBlock _status;

        public ImageDownloaderWindow(ImageCatalog catalog)
        {
            _catalog = catalog;
            Title = "Image Downloader";
            Width = 560;
            Height = 420;
            MinWidth = 480;
            MinHeight = 320;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;

            var root = new DockPanel { Margin = new Thickness(12) };
            Content = root;
            var heading = new TextBlock { Text = "Ranma Card Game", FontSize = 18,
                FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 8) };
            DockPanel.SetDock(heading, Dock.Top);
            root.Children.Add(heading);

            _status = new TextBlock { Text = "Select a set to update its card images.",
                Margin = new Thickness(0, 8, 0, 0), TextWrapping = TextWrapping.Wrap };
            DockPanel.SetDock(_status, Dock.Bottom);
            root.Children.Add(_status);

            var buttons = new StackPanel { Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 10, 0, 0) };
            DockPanel.SetDock(buttons, Dock.Bottom);
            root.Children.Add(buttons);

            _updateSelected = new Button { Content = "Update Selected Set", MinWidth = 145,
                Padding = new Thickness(8, 5, 8, 5), IsEnabled = false };
            _updateSelected.Click += async (sender, args) => await UpdateSelectedAsync();
            buttons.Children.Add(_updateSelected);
            _updateAll = new Button { Content = "Update All Sets", MinWidth = 125,
                Padding = new Thickness(8, 5, 8, 5), Margin = new Thickness(8, 0, 0, 0) };
            _updateAll.Click += async (sender, args) => await UpdateAsync(_catalog.Sets);
            buttons.Children.Add(_updateAll);

            _sets = new ListBox { DisplayMemberPath = "DisplayName" };
            _sets.SelectionChanged += (sender, args) => _updateSelected.IsEnabled = _sets.SelectedItem != null;
            foreach (var set in catalog.Sets) _sets.Items.Add(set);
            if (_sets.Items.Count > 0) _sets.SelectedIndex = 0;
            root.Children.Add(_sets);
        }

        private async Task UpdateSelectedAsync()
        {
            var set = _sets.SelectedItem as ImageSet;
            if (set != null) await UpdateAsync(new[] { set });
        }

        private async Task UpdateAsync(IEnumerable<ImageSet> sets)
        {
            SetBusy(true);
            try
            {
                _status.Text = "Downloading images...";
                var result = await ImageDownloader.UpdateSetsAsync(sets.ToList());
                _sets.Items.Refresh();
                _status.Text = String.Format("Downloaded {0} image(s). Unavailable/pending: {1}. Failed: {2}.",
                    result.Downloaded, result.Pending, result.Failed);
                if (result.Failed > 0)
                    MessageBox.Show(_status.Text, "Image Downloader", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            catch (Exception ex)
            {
                _status.Text = "The image update did not complete.";
                MessageBox.Show(ex.Message, "Image Downloader", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally { SetBusy(false); }
        }

        private void SetBusy(bool busy)
        {
            _sets.IsEnabled = !busy;
            _updateSelected.IsEnabled = !busy && _sets.SelectedItem != null;
            _updateAll.IsEnabled = !busy;
        }
    }

    internal static class ImageDownloader
    {
        private const string RepositoryBaseUrl = "https://octgn-multi-game-feed.awesome-mole.workers.dev/assets/ranma/";
        private const string ManifestUrl = RepositoryBaseUrl + "manifest.json";
        private static readonly HttpClient Client = CreateClient();

        private static HttpClient CreateClient()
        {
            var client = new HttpClient { Timeout = TimeSpan.FromSeconds(45) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("OCTGN-Ranma-Image-Downloader/0.2.7");
            return client;
        }

        public static async Task<ImageCatalog> LoadCatalogAsync(Game game)
        {
            var json = await Client.GetStringAsync(ManifestUrl);
            var manifest = new JavaScriptSerializer().Deserialize<Manifest>(json);
            Guid manifestGameId;
            if (manifest == null || !Guid.TryParse(manifest.gameGuid, out manifestGameId) ||
                manifestGameId != RanmaImageDownloaderPlugin.GameId)
                throw new InvalidDataException("The image catalog is for a different OCTGN game.");

            var installedSets = game.Sets().ToDictionary(s => s.Id, s => s);
            var catalogSets = new List<ImageSet>();
            foreach (var group in (manifest.images ?? new List<ManifestImage>())
                .GroupBy(image => image.setGuid, StringComparer.OrdinalIgnoreCase))
            {
                Guid setId;
                Set installedSet;
                if (!Guid.TryParse(group.Key, out setId) || !installedSets.TryGetValue(setId, out installedSet))
                    continue;
                catalogSets.Add(new ImageSet(installedSet, group.Select(image => CreateImage(setId, image)).ToList()));
            }

            foreach (var pending in manifest.missing ?? new List<ManifestImage>())
            {
                Guid setId;
                if (!Guid.TryParse(pending.setGuid, out setId)) continue;
                var set = catalogSets.FirstOrDefault(item => item.Id == setId);
                if (set != null) set.Pending++;
            }
            return new ImageCatalog(catalogSets.OrderBy(set => set.Name).ToList());
        }

        private static RemoteImage CreateImage(Guid setId, ManifestImage image)
        {
            Guid cardId;
            if (!Guid.TryParse(image.cardGuid, out cardId))
                throw new InvalidDataException("The image catalog contains an invalid card identifier.");
            var url = RepositoryBaseUrl + "images/" + setId + "/" + cardId + ".jpg";
            return new RemoteImage(cardId, url, image.sha256);
        }

        public static async Task<DownloadResult> UpdateSetsAsync(IEnumerable<ImageSet> sets)
        {
            var result = new DownloadResult();
            foreach (var set in sets)
            {
                Directory.CreateDirectory(set.ImageDirectory);
                foreach (var image in set.Images)
                {
                    var target = Path.Combine(set.ImageDirectory, image.CardId + ".jpg");
                    var temporary = target + ".download";
                    try
                    {
                        var bytes = await Client.GetByteArrayAsync(image.Url);
                        if (!String.IsNullOrWhiteSpace(image.Sha256) &&
                            !String.Equals(Sha256(bytes), image.Sha256, StringComparison.OrdinalIgnoreCase))
                            throw new InvalidDataException("Checksum mismatch for " + image.CardId + ".");
                        File.WriteAllBytes(temporary, bytes);
                        if (File.Exists(target)) File.Delete(target);
                        File.Move(temporary, target);
                        result.Downloaded++;
                    }
                    catch
                    {
                        if (File.Exists(temporary)) File.Delete(temporary);
                        result.Failed++;
                    }
                }
                result.Pending += set.Pending;
            }
            return result;
        }

        private static string Sha256(byte[] bytes)
        {
            using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
        }
    }

    internal sealed class ImageCatalog
    {
        public ImageCatalog(List<ImageSet> sets) { Sets = sets; }
        public List<ImageSet> Sets { get; private set; }
    }

    internal sealed class ImageSet
    {
        public ImageSet(Set set, List<RemoteImage> images)
        {
            Id = set.Id; Name = set.Name; ImageDirectory = set.ImagePackUri; Images = images;
        }
        public Guid Id { get; private set; }
        public string Name { get; private set; }
        public string ImageDirectory { get; private set; }
        public List<RemoteImage> Images { get; private set; }
        public int Pending { get; set; }
        public int Installed => Images.Count(image => File.Exists(Path.Combine(ImageDirectory, image.CardId + ".jpg")));
        public string DisplayName => String.Format("{0}    {1} of {2} installed{3}", Name, Installed,
            Images.Count, Pending == 0 ? String.Empty : " (" + Pending + " pending)");
    }

    internal sealed class RemoteImage
    {
        public RemoteImage(Guid cardId, string url, string sha256)
        { CardId = cardId; Url = url; Sha256 = sha256; }
        public Guid CardId { get; private set; }
        public string Url { get; private set; }
        public string Sha256 { get; private set; }
    }

    internal sealed class Manifest
    {
        public string gameGuid { get; set; }
        public List<ManifestImage> images { get; set; }
        public List<ManifestImage> missing { get; set; }
    }

    internal sealed class ManifestImage
    {
        public string cardGuid { get; set; }
        public string setGuid { get; set; }
        public string sha256 { get; set; }
    }

    internal sealed class DownloadResult
    {
        public int Downloaded { get; set; }
        public int Pending { get; set; }
        public int Failed { get; set; }
    }
}
