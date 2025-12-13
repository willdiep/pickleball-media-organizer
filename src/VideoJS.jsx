import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-hotkeys';

export const VideoJS = (props) => {
  const videoRef = React.useRef(null);
  const playerRef = React.useRef(null);
  const {options, onReady, className} = props;

  React.useEffect(() => {

    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode. 
      const videoElement = document.createElement("video-js");

      videoElement.classList.add('video-js', 'vjs-big-play-centered');
      videoElement.style.width = "100%";
      videoElement.style.height = "100%";
      if (className) {
        className
          .split(' ')
          .filter(Boolean)
          .forEach((cls) => videoElement.classList.add(cls));
      }
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        videojs.log('player is ready');

        // Enable keyboard hotkeys (e.g., arrow key seeking)
        if (typeof player.hotkeys === 'function') {
          player.hotkeys({
            seekStep: 0.1,
          });
        }

        onReady && onReady(player);
      });

    // You could update an existing player in the `else` block here
    // on prop change, for example:
    } else {
      const player = playerRef.current;

      if (className && player.el()) {
        className
          .split(' ')
          .filter(Boolean)
          .forEach((cls) => player.el().classList.add(cls));
      }
      player.autoplay(options.autoplay);
      player.src(options.sources);
    }
  }, [options, className]);

  // Dispose the Video.js player when the functional component unmounts
  React.useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div
      data-vjs-player
      className={className}
      style={{ width: "100%", height: "100%" }}
    >
      <div ref={videoRef} className="h-full w-full" />
    </div>
  );
}

export default VideoJS;
