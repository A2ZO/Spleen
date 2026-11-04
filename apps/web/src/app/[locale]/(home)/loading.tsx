import {
  Bone,
  CardListBone,
  PageSkeleton,
  SectionBone,
  TileGridBone,
} from "@/components/ui/Skeleton";

/* The home page's own skeleton: the route group keeps it off every other page. */
export default function HomeLoading() {
  return (
    <PageSkeleton className="space-y-12">
      <div className="space-y-3">
        <Bone className="h-3 w-32" />
        <Bone className="h-10 w-3/4 max-w-xl" />
      </div>
      <SectionBone>
        <TileGridBone />
      </SectionBone>
      <SectionBone>
        <CardListBone />
      </SectionBone>
    </PageSkeleton>
  );
}
