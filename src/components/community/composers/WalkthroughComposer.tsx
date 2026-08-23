import { Button, Input, NumberInput, RadioGroup, Select, Textarea } from '@/components/ui';
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

export const WALKTHROUGH_STEP_COUNT = 3;

function StepDots({ step }: { step: number }) {
  return (
    <div className="mb-4 flex gap-1.5" aria-hidden="true">
      {Array.from({ length: WALKTHROUGH_STEP_COUNT }, (_, index) => (
        <span
          key={index}
          className={`h-1 flex-1 rounded-full ${index < step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </div>
  );
}

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h3 className="text-base font-semibold">{title}</h3>
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
        {strings.toLet.composer.stepOf(step, WALKTHROUGH_STEP_COUNT)}
      </span>
    </div>
  );
}

function StepWhatIsIt({ form }: { form: ToLetFormApi }) {
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
        hint={strings.toLet.composer.categoryHint}
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
        <>
          <RadioGroup
            legend={strings.toLet.composer.genderPreferenceLabel}
            value={form.form.genderPreference}
            onChange={(value) => form.update('genderPreference', value)}
            options={form.genderOptions}
            variant="pills"
          />
          <RadioGroup
            legend={strings.toLet.composer.houseRulesLabel}
            value={form.form.houseRules}
            onChange={(value) => form.update('houseRules', value)}
            options={houseRulesOptions.map((option) => ({
              ...option,
              hint: strings.toLet.houseRulesHint[option.value as keyof typeof strings.toLet.houseRulesHint]
            }))}
          />
        </>
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

      <div className={form.isBachelor ? 'grid grid-cols-2 gap-3' : ''}>
        {form.isBachelor && (
          <NumberInput
            label={strings.toLet.composer.seatsAvailableLabel}
            value={form.form.seatsAvailable}
            onChange={(value) => form.update('seatsAvailable', value)}
            min={1}
            hint={strings.toLet.composer.seatsAvailableHint}
          />
        )}
        <div className={`flex gap-x-5 gap-y-2 ${form.isBachelor ? 'flex-col justify-end pb-2.5' : 'flex-wrap'}`}>
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
        </div>
      </div>
    </div>
  );
}

function StepMoneyAndRules({ form }: { form: ToLetFormApi }) {
  return (
    <div className="space-y-4">
      <Textarea
        label={strings.toLet.composer.descriptionLabel}
        value={form.form.text}
        onChange={(value) => form.update('text', value)}
        placeholder={strings.toLet.composer.descriptionPlaceholder}
        rows={3}
        maxLength={toLetConfig.maxDescriptionLength}
      />

      <div className="grid grid-cols-2 gap-3">
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
            checked={form.form.mealsProvided}
            onChange={(event) => form.update('mealsProvided', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
          />
          {strings.toLet.composer.mealsProvidedLabel}
        </label>
      </div>

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

      <ToLetLocationField form={form} />
    </div>
  );
}

function StepPhotosAndContact({ form }: { form: ToLetFormApi }) {
  return (
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

      <ToLetPhotoPicker form={form} />
    </div>
  );
}

export function WalkthroughComposer({ form, step }: { form: ToLetFormApi; step: number }) {
  const titles = [strings.toLet.composer.step1Title, strings.toLet.composer.step2Title, strings.toLet.composer.step3Title];

  return (
    <div>
      <StepDots step={step} />
      <StepHeading step={step} title={titles[step - 1]} />
      {step === 1 && <StepWhatIsIt form={form} />}
      {step === 2 && <StepMoneyAndRules form={form} />}
      {step === 3 && <StepPhotosAndContact form={form} />}
    </div>
  );
}

export function WalkthroughFooter({
  form,
  step,
  onStepChange
}: {
  form: ToLetFormApi;
  step: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <>
      {step > 1 && (
        <Button variant="secondary" onClick={() => onStepChange(step - 1)} disabled={form.saving}>
          {strings.toLet.composer.backAction}
        </Button>
      )}
      {step < WALKTHROUGH_STEP_COUNT ? (
        <Button onClick={() => onStepChange(step + 1)}>{strings.toLet.composer.nextAction}</Button>
      ) : (
        <Button onClick={() => void form.submit()} disabled={!form.canSubmit} loading={form.saving}>
          {form.saving
            ? strings.toLet.composer.submitting
            : form.editing
              ? strings.toLet.composer.submitEdit
              : form.reposting
                ? strings.toLet.composer.submitRepost
                : strings.toLet.composer.submitCreate}
        </Button>
      )}
    </>
  );
}

export default WalkthroughComposer;
