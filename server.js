const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const ytdl = require("@distube/ytdl-core");
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require("ffmpeg-static")
const play = require('play-dl');
const fs = require("fs")
const cp = require('child_process');
const stream = require('stream');
const agentOptions = {
    headers: {
        referer: "https://www.youtube.com/",
    },
}
const cookiesPath = path.join(__dirname, 'cookies.json');
const cookiesContent = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
const agent = ytdl.createAgent(cookiesContent, agentOptions);

process.on('uncaughtException', function (err) {
    console.log(err);
});

process.on('unhandledRejection', function (err) {
    console.log(err);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public_html')));

app.get('/api/download/audio/opus', async (req, res) => {
    try {
        const url = decodeURIComponent(req.query.url);

        // レスポンスヘッダをダウンロード用に設定
        res.setHeader('Content-Type', 'audio/ogg'); 
        res.setHeader('Content-Disposition', 'attachment; filename="audio.opus"');

        // dlChunkSizeを大きく（0指定）すると複数回のリクエストではなく
        // 一度のリクエストでまとめて受け取れる可能性がある（YouTube側次第）。
        const audioStream = ytdl(url, {
            filter: 'audioonly',
            highWaterMark: 1 << 28,
            dlChunkSize: 16, // これを大きく/0指定して"一括"リクエスト試行
        });

        // エラーハンドリング（ストリームは必須）
        audioStream.on('error', (err) => {
            console.error('Error:', err);
            res.status(500).send('Stream Error');
        });

        // ストリームをパイプして送信
        audioStream.pipe(res);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/download/audio/mp3', async (req, res) => {
    const url = decodeURIComponent(req.query.url);
    //if (!ytdl.validateURL(url)) return res.status(500).send('Error');
    try {
        const audioStream = await ytdl(url, { quality: 'highestaudio' , agent:agent, highWaterMark: 1 << 28});
        //ffmpegでopusからmp3に変換
        ffmpeg(audioStream)
            .setFfmpegPath(ffmpegPath)
            .audioBitrate(128)
            .format('mp3')
            .on('end', () => {
            })
            .pipe(res, { end: true })
        req.on('close', () => {
            audioStream.destroy();
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/download/video/mp4', async (req, res) => {
    const url = decodeURIComponent(req.query.url);
    //if (!ytdl.validateURL(url)) return res.status(500).send('Error');
    try {
    const ytdlm = (link, agent, options = {}) => {
    const result = new stream.PassThrough({ highWaterMark: options.highWaterMark || 1024 * 512 });
    ytdl.getInfo(link, options).then( async info => {
        audioStream = await ytdl(link, {quality: 'highestaudio', agent: agent , highWaterMark: 1 << 28});
        videoStream = await ytdl(link, {quality: 'highestvideo', agent: agent , highWaterMark: 1 << 28});
        // create the ffmpeg process for muxing
        ffmpegProcess = cp.spawn(ffmpegPath, [
        // supress non-crucial messages
        '-loglevel', '8', '-hide_banner',
        // input audio and video by pipe
        '-i', 'pipe:3', '-i', 'pipe:4',
        // map audio and video correspondingly
        '-map', '0:a', '-map', '1:v',
        // specify the video codec as HEVC (H.265)
        //'-c:v', 'libx265',
        '-c:v', 'copy',
        // specify the audio codec as MP3
        '-c:a', 'copy',
        // set the audio bitrate for MP3 to 320kbps
        //'-b:a', '320k',
        // output format as mp4 or matroska (mkv)
        '-f', 'matroska', 'pipe:5'
    ], {
            // no popup window for Windows users
            windowsHide: true,
            stdio: [
                // silence stdin/out, forward stderr,
                'inherit', 'inherit', 'inherit',
                // and pipe audio, video, output
                'pipe', 'pipe', 'pipe'
            ]
        });
        audioStream.pipe(ffmpegProcess.stdio[3]);
        videoStream.pipe(ffmpegProcess.stdio[4]);
        ffmpegProcess.stdio[5].pipe(result);
    });
    return result;
};
        const video = ytdlm(url, agent);
        video.pipe(res);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/getInfo', async (req, res) => {
    const url = req.query.url;
    //if (!ytdl.validateURL(url)) return res.status(500).send('Error');

    try {
        const songInfo = await play.video_info(url/*,{ agent:agent}*/);

        const musicInfo = {
    title: songInfo.video_details.title,
    url: songInfo.video_details.url,
    totalsec: songInfo.video_details.durationInSec,
    viewcount: songInfo.video_details.views,
    author: {
        name: songInfo.video_details.channel.name,
        url: songInfo.video_details.channel.url,
        subscriber_count: songInfo.video_details.channel.subscribers,
        verified: songInfo.video_details.channel.verified
    },
    thumbnail: songInfo.video_details.thumbnails[songInfo.video_details.thumbnails.length - 1].url
}

        res.json(musicInfo);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/search', async (req, res) => {
    const query = req.query.query;
    const limit = req.query.limit ?? 10;

    try {
        const searchResult = await play.search(query, { limit: limit });
        const searchResultMapped = searchResult.map(video => {
            return {
                title: video.title,
                url: video.url,
                totalsec: video.durationInSec,
                viewcount: video.views,
                author: {
                    name: video.channel.name,
                    url: video.channel.url,
                    subscriber_count: video.channel.subscribers,
                    verified: video.channel.verified,
                },
                thumbnail: video.thumbnails[Object.keys(video.thumbnails).length - 1].url
            }
        })
        

        res.json(searchResultMapped);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/getPlaylist', async (req, res) => {
    const url = req.query.url;

    try {
        const playlist = await play.playlist_info(url, { incomplete : true })
        const videos = await playlist.all_videos()
        const playlistInfo = videos.map(video => {
            return {
                title: video.title,
                url: video.url,
                totalsec: video.durationInSec,
                viewcount: video.views,
                author: {
                    name: video.channel.name,
                    url: video.channel.url,
                    subscriber_count: video.channel.subscribers,
                    verified: video.channel.verified,
                },
                thumbnail: video.thumbnails[Object.keys(video.thumbnails).length - 1].url
            }
        })

        res.json(playlistInfo);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
})

const PORT = 3051;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
