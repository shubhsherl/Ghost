module.exports = (post) => {
    console.log(post);
    return {
        "alias": post.slug,
        "avatar": "http://res.guggy.com/logo_128.png",
        "emoji": ":smirk:",
        "roomId": post.room_id,
        "text": post.title,
        "attachments": [
            {
                "audio_url": "http://www.w3schools.com/tags/horse.mp3",
                "author_icon": "https://avatars.githubusercontent.com/u/850391?v=3",
                "author_link": "https://rocket.chat/",
                "author_name": "Bradley Hilton",
                // "collapsed": false,
                "color": "#ff0000",
                "fields": [
                    {
                        // "short": true,
                        "title": "Test",
                        "value": "Testing out something or other"
                    },
                    {
                        // "short": true,
                        "title": "Another Test",
                        "value": "[Link](https://google.com/) something and this and that."
                    }
                ],
                "image_url": "http://res.guggy.com/logo_128.png",
                "message_link": "https://google.com",
                "text": "Yay for gruggy!",
                "thumb_url": "http://res.guggy.com/logo_128.png",
                "title": "Attachment Example",
                "title_link": "https://youtube.com",
                // "title_link_download": true,
                "ts": post.updated_at,
                "video_url": "http://www.w3schools.com/tags/movie.mp4"
            }
        ]
    };
}
