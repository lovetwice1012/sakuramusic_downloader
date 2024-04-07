window.onload = function () {
    document.getElementById("downloadForm").addEventListener("submit", function (event) {
        event.preventDefault();

        const submit = document.getElementById("submit");
        submit.disabled = true;

        const resultURL = document.getElementById("resultURL");
        const uri = new URL(window.location.href);
        resultURL.href = uri.origin + uri.pathname + "?url=" + encodeURIComponent(document.getElementById("url").value) + "&format=" + document.querySelector('input[name="format"]:checked').value;

        const directdownload = document.getElementById("directdownload");
        if (directdownload.checked) {
            const url = document.getElementById("url").value;
            const format = document.querySelector('input[name="format"]:checked').value;
            //get music data
            fetch("/api/getInfo?url=" + encodeURIComponent(url), {
                method: "GET",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
            })
                .then(response_videodata => {
                    return responseCheckAndReturnJson(response_videodata);
                })
                .then(response_videodata => {
                    const link = document.createElement('a')
                    switch (format) {
                        case "opus":
                        case "mp3":
                            link.download = response_videodata.title + "." + format
                            link.href = `/api/download/audio/${format}?url=` + encodeURIComponent(url)
                            break;
                        case "mp4":
                            link.download = response_videodata.title + ".mp4"
                            link.href = `/api/download/video/${format}?url=` + encodeURIComponent(url)
                            break;
                    }
                    link.click()
                    submit.disabled = false;
                })
                .catch(error => {
                    submit.disabled = false;
                    console.error('There has been a problem with your fetch operation:', error);
                });
            submit.disabled = false;
            return;
        }

        setStatus("downloading");

        const url = document.getElementById("url").value;
        const format = document.querySelector('input[name="format"]:checked').value;
        fetch("/api/getInfo?url=" + encodeURIComponent(url), {
            method: "GET",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
        })
            .then(response_videodata => {
                return responseCheckAndReturnJson(response_videodata);
            })
            .then(response_videodata => {
                switch (format) {
                    case "opus":
                    case "mp3":
                        fetch(`/api/download/audio/${format}?url=` + encodeURIComponent(url), {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                        })
                            .then(response => {
                                return responseCheckAndReturnBlob(response);
                            })
                            .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                setAudioPlayer(url, response_videodata.title + "." + format);
                                stopVideoPlayer();
                                showMusicInfo(response_videodata);
                                setStatus("success");
                                submit.disabled = false;
                            })
                            .catch(error => {
                                reportFetchError(error, "Status: Failed to download audio.");
                            });
                        break;
                    case "mp4":
                        fetch(`/api/download/video/${format}?url=` + encodeURIComponent(url), {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                        })
                            .then(response => {
                                return responseCheckAndReturnBlob(response, "Status: Failed to download video.");
                            })
                            .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                setVideoPlayer(url, response_videodata.title + "." + format);
                                stopAudioPlayer();
                                showMusicInfo(response_videodata);
                                setStatus("success");
                                submit.disabled = false;
                            })
                            .catch(error => {
                                reportFetchError(error, "Status: Failed to download video.");
                            });
                        break;
                }
            }).catch(error => {
                reportFetchError(error);
            });
    });

    let ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (ios) {
        const directdownload = document.getElementById("directdownload");
        directdownload.checked = true;
        directdownload.disabled = true;
    }

    //check if url parameter exists
    const url = new URL(window.location.href);
    const urlParams = url.searchParams;
    const urlParamUrl = urlParams.get("url");
    const urlParamFormat = urlParams.get("format");
    if (urlParamFormat) {
        document.querySelector('input[name="format"][value="' + urlParamFormat + '"]').checked = true;
    }

    //check browser is support opus
    const audio = new Audio();
    if (audio.canPlayType("audio/ogg; codecs=opus") === "") {
        const opus = document.querySelector('input[name="format"][value="opus"]');
        opus.disabled = true;
        if (opus.checked) {
            document.querySelector('input[name="format"][value="mp3"]').checked = true;
        }
    }

    //check browser is support mp3
    if (audio.canPlayType("audio/mpeg") === "") {
        const mp3 = document.querySelector('input[name="format"][value="mp3"]');
        mp3.disabled = true;
        if (mp3.checked) {
            document.querySelector('input[name="format"][value="mp4"]').checked = true;
        }
    }

    //check browser is support mp4
    if (audio.canPlayType("video/mp4") === "") {
        const mp4 = document.querySelector('input[name="format"][value="mp4"]');
        mp4.disabled = true;
        if (mp4.checked) {
            document.querySelector('input[name="format"][value="mp3"]').checked = true;
        }
    }

    //if all formats are disabled
    if (document.querySelectorAll('input[name="format"]:disabled').length === document.querySelectorAll('input[name="format"]').length) {
        document.getElementById("status").textContent = "Status: Your browser does not support any formats.";
        document.getElementById("status").style.color = "red";
        document.getElementById("submit").disabled = true;
    }

    //if url parameter exists, download
    if (urlParamUrl) {
        document.getElementById("url").value = urlParamUrl;
        document.getElementById("submit").click();
    }

    function showMusicInfo(response_videodata) {
        const musicinfo = document.getElementById("musicinfo");
        musicinfo.style.display = "block";
        document.getElementById("title").textContent = "Title: " + response_videodata.title;
        document.getElementById("url").textContent = "URL: " + response_videodata.url;
        document.getElementById("totalsec").textContent = "TotalSec: " + response_videodata.totalsec;
        document.getElementById("viewcount").textContent = "ViewCount: " + response_videodata.viewcount;
        document.getElementById("author").textContent = "Author: " + response_videodata.author.name;
        document.getElementById("authorurl").setAttribute("href", response_videodata.author.url);
        document.getElementById("authorurl").textContent = response_videodata.author.url;
        document.getElementById("subscriber_count").textContent = "SubscriberCount: " + response_videodata.author.subscriber_count;
        document.getElementById("verified").textContent = "Verified: " + response_videodata.author.verified;
        document.getElementById("thumbnail").src = response_videodata.thumbnail;
    }

    function setStatus(status, message = "", color = "red") {
        switch (status) {
            case "downloading":
                document.getElementById("status").textContent = "Downloading...";
                document.getElementById("status").style.color = "aqua";
                break;
            case "success":
                document.getElementById("status").textContent = "Status: SUCCESS!!";
                document.getElementById("status").style.color = "green";
                break;
            case "failed":
                document.getElementById("status").textContent = "Status: Failed to download.";
                document.getElementById("status").style.color = "red";
                break;
            case "ready":
                document.getElementById("status").textContent = "Status: Ready";
                document.getElementById("status").style.color = "green";
                break;
            case "custom":
                document.getElementById("status").textContent = message;
                document.getElementById("status").style.color = color;
                break;
        }
    }

    function responseCheckAndReturnJson(response, statusMessage = "Status: Failed to get video data.", statusColor = "red") {
        if (!response.ok) {
            document.getElementById("status").textContent = statusMessage;
            document.getElementById("status").style.color = statusColor;
            document.getElementById("submit").disabled = false;
            throw new Error('Network response was not ok');
        }
        return response.json();
    }

    function responseCheckAndReturnBlob(response, statusMessage = "Status: Failed to download.", statusColor = "red") {
        if (!response.ok) {
            setStatus("custom", statusMessage, statusColor);
            document.getElementById("submit").disabled = false;
            throw new Error('Network response was not ok');
        }
        return response.blob();
    }

    function reportFetchError(error, statusMessage = "Status: Failed to fetch.", statusColor = "red") {
        setStatus("custom", statusMessage, statusColor);
        document.getElementById("submit").disabled = false;
        console.error('There has been a problem with your fetch operation:', error);
    }

    function setAudioPlayer(url, title) {
        const audioPlayer = document.getElementById("audioPlayer");
        audioPlayer.src = url;
        audioPlayer.style.display = "block";
    }

    function setVideoPlayer(url, title) {
        const videoPlayer = document.getElementById("videoPlayer");
        videoPlayer.src = url;
        videoPlayer.style.display = "block";
    }

    function stopAudioPlayer() {
        const audioPlayer = document.getElementById("audioPlayer");
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.style.display = "none";
        if (audioPlayer.src) {
            audioPlayer.src = "";
        }
    }

    function stopVideoPlayer() {
        const videoPlayer = document.getElementById("videoPlayer");
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
        videoPlayer.style.display = "none";
        if (videoPlayer.src) {
            videoPlayer.src = "";
        }
    }
}