interface TransactionListFooterProps {
  displayCount: number;
  totalCount?: number;
  showFiltered?: boolean;
}

export function TransactionListFooter({
  displayCount,
  totalCount,
  showFiltered,
}: TransactionListFooterProps) {
  return (
    <div className="flex items-center justify-between text-[8px] text-muted-foreground italic">
      <span>Merged from CSV statements</span>
      <span className="not-italic">
        {showFiltered && totalCount !== undefined
          ? `showing ${displayCount}/${totalCount}`
          : `total ${displayCount}`}
      </span>
    </div>
  );
}

