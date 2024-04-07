const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core');
const path = require('path');
const ytdlm = require('ytdl-core-muxer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require("ffmpeg-static")

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

const PORT = 3051;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
