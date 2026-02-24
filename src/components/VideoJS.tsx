import {useEffect, useRef } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import 'videojs-hotkeys';

interface VideoJSOptions {
  autoplay?: boolean;
  controls?: boolean;
  responsive?: boolean;
  fluid?: boolean;
  fill?: boolean;
  sources?: Array<{
    src: string;
    type: string;
  }>;
}

interface VideoJSProps {
  options: VideoJSOptions;
  onReady?: (player: Player) => void;
  className?: string;
}

// Extend Player type for hotkeys plugin
interface PlayerWithHotkeys extends Player {
  hotkeys?: (options: { seekStep: number }) => void;
}

export const VideoJS = (props: VideoJSProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const { options, onReady, className } = props;

  useEffect(() => {
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
      videoRef.current?.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        videojs.log('player is ready');

        // Enable keyboard hotkeys (e.g., arrow key seeking)
        const playerWithHotkeys = player as PlayerWithHotkeys;
        if (typeof playerWithHotkeys.hotkeys === 'function') {
          playerWithHotkeys.hotkeys({
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
          .forEach((cls) => player.el()?.classList.add(cls));
      }
      player.autoplay(options.autoplay ?? false);
      player.src(options.sources ?? []);
    }
  }, [options, className, onReady]);

  // Dispose the Video.js player when the functional component unmounts
useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      data-vjs-player
      className={className}
      style={{ width: "100%", height: "100%" }}
    >
      <div ref={videoRef} className="h-full w-full" />
    </div>
  );
};

export default VideoJS;
