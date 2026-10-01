interface TagBadgeProps {
  name: string;
}

const TagBadge = (props: TagBadgeProps) => (
  <span class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
    {props.name}
  </span>
);

export default TagBadge;
