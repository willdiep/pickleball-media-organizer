import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "@/lib/utils";

export const Spinner: Component<JSX.SvgSVGAttributes<SVGSVGElement>> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <svg
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      fill="none"
      class={cn("size-4 animate-spin", local.class)}
      {...others}
    >
      <path
        d="M12 3a9 9 0 1 0 9 9"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
};
