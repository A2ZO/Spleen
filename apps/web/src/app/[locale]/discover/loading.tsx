import {
  Bone,
  CardListBone,
  PageSkeleton,
  SectionBone,
  TileGridBone,
} from "@/components/ui/Skeleton";

export default function DiscoverLoading() {
  return (
    <PageSkeleton className="space-y-16">
      <div className="space-y-3">
        <Bone className="h-10 w-1/2 max-w-md" />
        <Bone className="h-3 w-2/3 max-w-lg" />
      </div>
      <SectionBone>
        <TileGridBone />
      </SectionBone>
      <SectionBone>
        <TileGridBone />
      </SectionBone>
      <SectionBone>
        <CardListBone count={2} />
      </SectionBone>
    </PageSkeleton>
  );
}
