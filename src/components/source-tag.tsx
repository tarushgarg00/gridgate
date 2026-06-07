import type { SourceRef } from "@/types/site-brief";

type SourceTagProps = {
  source: SourceRef;
  label?: string;
};

export function SourceTag({ source, label }: SourceTagProps) {
  return (
    <a
      className="source-tag"
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.name}
    >
      {label ?? source.name}
    </a>
  );
}
