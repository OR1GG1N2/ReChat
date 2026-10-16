import React from 'react';

export default function PageHeader({
  title,
  description,
  badge = null,
  children = null,
}) {
  return (
    <div className="flex items-end justify-between mb-5 select-none font-['Manrope',sans-serif]">
      <div>
        <h1 className="text-[22px] font-bold text-[#ECECF1] leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[12px] text-[#A0A4B4] mt-1 leading-normal">
            {description}
          </p>
        )}
      </div>

      {(badge || children) && (
        <div className="flex items-center gap-3">
          {badge && (
            <span className="text-[12px] text-[#A0A4B4] flex items-center gap-1.5">
              <span
                className={`w-[7px] h-[7px] rounded-full shrink-0 ${
                  badge.color ||
                  (badge.status === 'warn'
                    ? 'bg-[#FFB84D]'
                    : badge.status === 'off'
                    ? 'bg-[#6B7080]'
                    : 'bg-[#7CF2C8]')
                }`}
              />
              <span>{badge.text}</span>
            </span>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
