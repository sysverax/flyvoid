interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-none tracking-[0%]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-[#6B7280] mt-1 font-normal">
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
