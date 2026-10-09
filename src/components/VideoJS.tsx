import { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import "videojs-hotkeys";

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

type PlayerWithHotkeys = Player & {
  hotkeys?: (options?: { seekStep?: number }) => void;
};

export const VideoJS = ({ options, onReady, className }: VideoJSProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const mountPoint = mountRef.current;
    if (!mountPoint) return;

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("video-js", "vjs-big-play-centered");
    videoElement.style.width = "100%";
    videoElement.style.height = "100%";
    mountPoint.appendChild(videoElement);

    const instance = videojs(videoElement, options, () => {
      const withHotkeys = instance as PlayerWithHotkeys;
      if (typeof withHotkeys.hotkeys === "function") {
        withHotkeys.hotkeys({ seekStep: 0.1 });
      }
      onReadyRef.current?.(instance);
    });
    playerRef.current = instance;

    return () => {
      if (!instance.isDisposed()) {
        instance.dispose();
      }
      playerRef.current = null;
    };
    // The player is created once; later source changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = playerRef.current;
    if (!instance || instance.isDisposed()) return;
    instance.autoplay(options.autoplay ?? false);
    instance.src(options.sources ?? []);
  }, [options]);

  return (
    <div data-vjs-player className={className} style={{ width: "100%", height: "100%" }}>
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
};

export default VideoJS;
