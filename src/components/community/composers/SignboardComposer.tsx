import { useState } from 'react';
import { Input, NumberInput, RadioGroup, Select, Textarea } from '@/components/ui';
import { toLetConfig } from '@/config';
import { strings } from '@/lib/i18n';
import { TOLET_HOUSE_RULES, TOLET_TENANT_RESTRICTION } from '@/lib/constants';
import {
  ToLetContactFields,
  ToLetLocationField,
  ToLetPhotoPicker,
  ToLetUnitDetailsFields
} from '@/components/community/composers/ToLetComposerShared';
import type { ToLetFormApi } from '@/components/community/useToLetForm';

function AmenityChips({ form }: { form: ToLetFormApi }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {strings.toLet.composer.amenitiesLabel}
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {form.amenityOptions.map((option) => {
          const on = form.form.amenities.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => form.toggleAmenity(option.value)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                on
                  ? 'bg-brand-600 font-medium text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SignboardComposer({ form }: { form: ToLetFormApi }) {
  const [showMore, setShowMore] = useState(false);
  const houseRulesOptions = [
    { value: TOLET_HOUSE_RULES.FLEXIBLE, label: strings.toLet.houseRules.FLEXIBLE },
    { value: TOLET_HOUSE_RULES.STRICT, label: strings.toLet.houseRules.STRICT }
  ];
  const categoryOptions = [
    { value: TOLET_TENANT_RESTRICTION.BACHELOR, label: strings.toLet.tenantRestriction.BACHELOR },
    { value: TOLET_TENANT_RESTRICTION.FAMILY, label: strings.toLet.tenantRestriction.FAMILY }
  ];

  return (
    <div className="space-y-4">
      <RadioGroup
        legend={strings.toLet.composer.categoryLabel}
        value={form.form.tenantRestriction}
        onChange={(value) => form.update('tenantRestriction', value)}
        options={categoryOptions}
        variant="pills"
      />

      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-600 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.form.isSublet}
          onChange={(event) => form.update('isSublet', event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
        />
        <span>
          <span className="block font-medium">{strings.toLet.composer.subletLabel}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{strings.toLet.composer.subletHint}</span>
        </span>
      </label>

      {form.isBachelor && (
        <div className="flex flex-wrap gap-2">
          {form.genderOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={form.form.genderPreference === option.value}
              onClick={() => form.update('genderPreference', option.value)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                form.form.genderPreference === option.value
                  ? 'bg-brand-600 font-medium text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
          {houseRulesOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={form.form.houseRules === option.value}
              onClick={() => form.update('houseRules', option.value)}
              title={strings.toLet.houseRulesHint[option.value as keyof typeof strings.toLet.houseRulesHint]}
              className={`rounded-full px-4 py-2 text-sm transition ${
                form.form.houseRules === option.value
                  ? 'bg-amber-500 font-medium text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <Select
        label={strings.toLet.composer.roomLabel}
        value={form.form.listingType}
        onChange={(value) => form.update('listingType', value)}
        options={form.typeOptions}
        compact
      />

      <ToLetUnitDetailsFields form={form} />

      <Input
        label={strings.toLet.composer.titleLabel}
        value={form.form.title}
        onChange={(value) => form.update('title', value)}
        placeholder={strings.toLet.composer.titlePlaceholder}
        maxLength={toLetConfig.maxTitleLength}
      />

      <Textarea
        label={strings.toLet.composer.descriptionLabel}
        value={form.form.text}
        onChange={(value) => form.update('text', value)}
        placeholder={strings.toLet.composer.descriptionPlaceholder}
        rows={3}
        maxLength={toLetConfig.maxDescriptionLength}
      />

      <div className={`grid grid-cols-2 gap-3 ${form.isBachelor ? 'sm:grid-cols-3' : ''}`}>
        <NumberInput
          label={strings.toLet.composer.rentLabel}
          value={form.form.rent}
          onChange={(value) => form.update('rent', value)}
          min={0}
          optional
        />
        <Select
          label={strings.toLet.composer.advanceMonthsLabel}
          value={form.form.advanceMonths}
          onChange={(value) => form.update('advanceMonths', value)}
          options={form.advanceOptions}
          compact
        />
        {form.isBachelor && (
          <NumberInput
            label={strings.toLet.composer.seatsAvailableLabel}
            value={form.form.seatsAvailable}
            onChange={(value) => form.update('seatsAvailable', value)}
            min={1}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.form.rentNegotiable}
            onChange={(event) => form.update('rentNegotiable', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          {strings.toLet.composer.negotiableLabel}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.form.serviceChargeIncluded}
            onChange={(event) => form.update('serviceChargeIncluded', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          {strings.toLet.composer.serviceChargeLabel}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.form.attachedBath}
            onChange={(event) => form.update('attachedBath', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          {strings.toLet.composer.attachedBathLabel}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.form.attachedBalcony}
            onChange={(event) => form.update('attachedBalcony', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          {strings.toLet.composer.attachedBalconyLabel}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.form.mealsProvided}
            onChange={(event) => form.update('mealsProvided', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          {strings.toLet.composer.mealsProvidedLabel}
        </label>
      </div>

      <ToLetLocationField form={form} />

      <AmenityChips form={form} />

      <button
        type="button"
        onClick={() => setShowMore((current) => !current)}
        aria-expanded={showMore}
        className="flex w-full items-center justify-between rounded-xl border-t border-slate-100 dark:border-slate-700 py-3 text-sm font-medium text-brand-700 transition-colors hover:text-brand-800"
      >
        {showMore ? strings.toLet.composer.fewerOptions : strings.toLet.composer.moreOptions}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${showMore ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {showMore && (
        <div className="space-y-4">
          <Select
            label={strings.toLet.composer.availableMonthLabel}
            value={form.form.availableMonth}
            onChange={(value) => form.update('availableMonth', value)}
            options={form.monthOptions}
            compact
          />

          <ToLetContactFields form={form} />

          <RadioGroup
            legend={strings.toLet.composer.expiryLabel}
            value={String(form.form.expiryDays)}
            onChange={(value) => form.update('expiryDays', Number(value))}
            options={form.expiryOptions}
            variant="pills"
          />
        </div>
      )}

      <ToLetPhotoPicker form={form} />
    </div>
  );
}

export default SignboardComposer;
