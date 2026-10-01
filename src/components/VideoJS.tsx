import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
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
  class?: string;
}

type PlayerWithHotkeys = Player & {
  hotkeys?: (options?: { seekStep?: number }) => void;
};

export const VideoJS = (props: VideoJSProps) => {
  let mountPoint: HTMLDivElement | undefined;
  const [player, setPlayer] = createSignal<Player>();

  onMount(() => {
    if (!mountPoint) return;

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("video-js", "vjs-big-play-centered");
    videoElement.style.width = "100%";
    videoElement.style.height = "100%";
    props.class
      ?.split(" ")
      .filter(Boolean)
      .forEach((cls) => videoElement.classList.add(cls));
    mountPoint.appendChild(videoElement);

    const instance = videojs(videoElement, props.options, () => {
      const withHotkeys = instance as PlayerWithHotkeys;
      if (typeof withHotkeys.hotkeys === "function") {
        withHotkeys.hotkeys({ seekStep: 0.1 });
      }
      props.onReady?.(instance);
    });
    setPlayer(instance);
  });

  createEffect(() => {
    const instance = player();
    const options = props.options;
    const className = props.class;
    if (!instance) return;

    if (className && instance.el()) {
      className
        .split(" ")
        .filter(Boolean)
        .forEach((cls) => instance.el()?.classList.add(cls));
    }
    instance.autoplay(options.autoplay ?? false);
    instance.src(options.sources ?? []);
  });

  onCleanup(() => {
    const instance = player();
    if (instance && !instance.isDisposed()) {
      instance.dispose();
    }
  });

  return (
    <div
      data-vjs-player
      class={props.class}
      style={{ width: "100%", height: "100%" }}
    >
      <div ref={mountPoint} class="h-full w-full" />
    </div>
  );
};

export default VideoJS;
