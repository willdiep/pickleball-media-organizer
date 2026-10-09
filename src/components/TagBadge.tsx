import { Badge } from "@/components/ui/badge";

interface TagBadgeProps {
  name: string;
}

const TagBadge = ({ name }: TagBadgeProps) => (
  <Badge
    variant="secondary"
    className="rounded-full px-2.5 py-0.5 font-medium capitalize"
  >
    {name}
  </Badge>
);

export default TagBadge;
