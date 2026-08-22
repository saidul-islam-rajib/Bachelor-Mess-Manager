import { FilterBar, Listbox, NumberInput, SearchInput } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { TOLET_TYPE_VALUES } from '@/lib/constants';

export type ToLetFilterValues = {
  q: string;
  type: string;
  minRent: string;
  maxRent: string;
};

export const EMPTY_TOLET_FILTERS: ToLetFilterValues = { q: '', type: '', minRent: '', maxRent: '' };

export function ToLetFilters({
  value,
  onChange
}: {
  value: ToLetFilterValues;
  onChange: (value: ToLetFilterValues) => void;
}) {
  const activeCount = [value.type, value.minRent, value.maxRent].filter(Boolean).length;

  const typeOptions = [
    { value: '', label: strings.toLet.typeAll },
    ...TOLET_TYPE_VALUES.map((type) => ({
      value: type,
      label: strings.toLet.types[type as keyof typeof strings.toLet.types]
    }))
  ];

  return (
    <FilterBar
      activeCount={activeCount}
      onClear={() => onChange({ ...EMPTY_TOLET_FILTERS, q: value.q })}
    >
      <SearchInput
        className="min-w-[220px] flex-1"
        value={value.q}
        onChange={(q) => onChange({ ...value, q })}
        placeholder={strings.toLet.searchPlaceholder}
      />
      <Listbox
        className="w-40"
        label={strings.toLet.typeLabel}
        value={value.type}
        onChange={(type) => onChange({ ...value, type })}
        options={typeOptions}
      />
      <NumberInput
        label={strings.toLet.minRentLabel}
        value={value.minRent}
        onChange={(minRent) => onChange({ ...value, minRent })}
        containerClassName="w-28"
        min={0}
      />
      <NumberInput
        label={strings.toLet.maxRentLabel}
        value={value.maxRent}
        onChange={(maxRent) => onChange({ ...value, maxRent })}
        containerClassName="w-28"
        min={0}
      />
    </FilterBar>
  );
}

export default ToLetFilters;
