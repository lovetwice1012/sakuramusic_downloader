const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core');
const path = require('path');
const ytdlm = require('ytdl-core-muxer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require("ffmpeg-static")
const play = require('play-dl');

process.on('uncaughtException', function (err) {
    console.log(err);
});

process.on('unhandledRejection', function (err) {
    console.log(err);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public_html')));

app.get('/api/download/audio/opus', async (req, res) => {
    const url = decodeURIComponent(req.query.url);
    try {
        const audioStream = ytdl(url, { quality: 'highestaudio' });
        audioStream.pipe(res);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/download/audio/mp3', async (req, res) => {
    const url = decodeURIComponent(req.query.url);
    try {
        const audioStream = ytdl(url, { quality: 'highestaudio' });
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
    try {
        const video = ytdlm(url);
        video.pipe(res);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error');
    }
});

app.get('/api/getInfo', async (req, res) => {
    const url = req.query.url;

    try {
        const songInfo = await ytdl.getInfo(url);

        const musicInfo = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            totalsec: songInfo.videoDetails.lengthSeconds,
            viewcount: songInfo.videoDetails.viewCount,
            author: {
                name: songInfo.videoDetails.author.name,
                url: songInfo.videoDetails.author.channel_url,
                subscriber_count: songInfo.videoDetails.author.subscriber_count,
                verified: songInfo.videoDetails.author.verified
            },
            thumbnail: songInfo.videoDetails.thumbnails[Object.keys(songInfo.videoDetails.thumbnails).length - 1].url
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
