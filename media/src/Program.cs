using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Windows.Media.Control;
using Windows.Storage.Streams;

public class TrackInfo
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = "stopped";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("artist")]
    public string Artist { get; set; } = "";

    [JsonPropertyName("album")]
    public string Album { get; set; } = "";

    [JsonPropertyName("thumbnail")]
    public string Thumbnail { get; set; } = "";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";
}

[JsonSerializable(typeof(TrackInfo))]
internal partial class SourceGenerationContext : JsonSerializerContext
{
}

class Program
{
    static GlobalSystemMediaTransportControlsSessionManager? manager;
    static string lastJson = "";

    static async Task Main(string[] args)
    {
        try
        {
            manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            if (manager != null)
            {
                manager.CurrentSessionChanged += async (s, e) => await CheckAndEmit();
            }

            // Also poll every 1s to catch position or state changes that don't trigger events
            while (true)
            {
                await CheckAndEmit();
                await Task.Delay(1000);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("{\"status\":\"error\",\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}");
        }
    }

    static async Task CheckAndEmit()
    {
        try
        {
            if (manager == null) manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            var session = manager?.GetCurrentSession();
            if (session == null)
            {
                Emit(new TrackInfo { Status = "stopped" });
                return;
            }

            var playback = session.GetPlaybackInfo();
            string status = playback?.PlaybackStatus.ToString().ToLower() ?? "stopped";

            var props = await session.TryGetMediaPropertiesAsync();
            string title = props?.Title ?? "";
            string artist = props?.Artist ?? "";
            string album = props?.AlbumTitle ?? "";

            string thumbBase64 = "";
            if (props?.Thumbnail != null)
            {
                try
                {
                    using var stream = await props.Thumbnail.OpenReadAsync();
                    using var reader = new DataReader(stream);
                    await reader.LoadAsync((uint)stream.Size);
                    byte[] bytes = new byte[stream.Size];
                    reader.ReadBytes(bytes);
                    thumbBase64 = "data:image/jpeg;base64," + Convert.ToBase64String(bytes);
                }
                catch { }
            }

            var info = new TrackInfo
            {
                Status = status,
                Title = title,
                Artist = artist,
                Album = album,
                Thumbnail = thumbBase64,
                Source = session.SourceAppUserModelId ?? ""
            };

            Emit(info);
        }
        catch
        {
            // Ignore temporary COM errors when switching tracks
        }
    }

    static void Emit(TrackInfo info)
    {
        // Don't repeat identical payload unless status changed
        string json = JsonSerializer.Serialize(info, SourceGenerationContext.Default.TrackInfo);
        if (json != lastJson)
        {
            lastJson = json;
            Console.WriteLine(json);
        }
    }
}
