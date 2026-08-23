import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useToast } from '@/components/ToastProvider';
import { toLetConfig, uploadConfig } from '@/config';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import {
  TOLET_AMENITY_VALUES,
  TOLET_GENDER_PREFERENCE,
  TOLET_GENDER_PREFERENCE_VALUES,
  TOLET_HOUSE_RULES,
  TOLET_MONTHS,
  TOLET_TENANT_RESTRICTION,
  TOLET_TYPES,
  TOLET_TYPE_VALUES
} from '@/lib/constants';
import { formatBytes } from '@/lib/format';
import { ACCEPTED_IMAGE_MIMES } from '@/lib/uploads.client';
import type { CommunityMessageView } from '@/lib/community';
import type { GeoSuggestion } from '@/lib/geo';

const LOCATION_SEARCH_MIN_LENGTH = 3;
const LOCATION_SEARCH_DEBOUNCE_MS = 400;

export type ToLetFormState = {
  listingType: string;
  title: string;
  text: string;
  rent: string;
  rentNegotiable: boolean;
  location: string;
  latitude: number | null;
  longitude: number | null;
  genderPreference: string;
  tenantRestriction: string;
  houseRules: string;
  isSublet: boolean;
  seatsAvailable: string;
  attachedBath: boolean;
  attachedBalcony: boolean;
  serviceChargeIncluded: boolean;
  advanceMonths: string;
  amenities: string[];
  mealsProvided: boolean;
  availableMonth: string;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  whatsappSameAsPhone: boolean;
  contactFacebook: string;
  hasContact2: boolean;
  contact2Name: string;
  contact2Phone: string;
  contact2Whatsapp: string;
  contact2WhatsappSameAsPhone: boolean;
  contact2Facebook: string;
  sourceUrl: string;
  expiryDays: number;
  images: string[];
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(strings.uploads.imageUnreadable));
    reader.readAsDataURL(file);
  });
}

function emptyForm(defaultContactName: string, defaultContactPhone: string): ToLetFormState {
  return {
    listingType: TOLET_TYPE_VALUES[0],
    title: '',
    text: '',
    rent: '',
    rentNegotiable: false,
    location: '',
    latitude: null,
    longitude: null,
    genderPreference: TOLET_GENDER_PREFERENCE.MALE,
    tenantRestriction: TOLET_TENANT_RESTRICTION.BACHELOR,
    houseRules: TOLET_HOUSE_RULES.FLEXIBLE,
    isSublet: false,
    seatsAvailable: '',
    attachedBath: false,
    attachedBalcony: false,
    serviceChargeIncluded: false,
    advanceMonths: '',
    amenities: [],
    mealsProvided: false,
    availableMonth: '',
    contactName: defaultContactName,
    contactPhone: defaultContactPhone,
    contactWhatsapp: '',
    whatsappSameAsPhone: true,
    contactFacebook: '',
    hasContact2: false,
    contact2Name: '',
    contact2Phone: '',
    contact2Whatsapp: '',
    contact2WhatsappSameAsPhone: true,
    contact2Facebook: '',
    sourceUrl: '',
    expiryDays: toLetConfig.defaultExpiryDays,
    images: []
  };
}

function formFromSource(
  source: CommunityMessageView,
  defaultContactName: string,
  defaultContactPhone: string
): ToLetFormState {
  return {
    listingType: source.listingType ?? TOLET_TYPE_VALUES[0],
    title: source.title ?? '',
    text: source.text,
    rent: source.rent !== null ? String(source.rent) : '',
    rentNegotiable: source.rentNegotiable,
    location: source.location ?? '',
    latitude: source.latitude,
    longitude: source.longitude,
    genderPreference: source.genderPreference ?? TOLET_GENDER_PREFERENCE.MALE,
    tenantRestriction:
      source.tenantRestriction && source.tenantRestriction !== TOLET_TENANT_RESTRICTION.ANY
        ? source.tenantRestriction
        : TOLET_TENANT_RESTRICTION.BACHELOR,
    houseRules: source.houseRules ?? TOLET_HOUSE_RULES.FLEXIBLE,
    isSublet: source.isSublet,
    seatsAvailable: source.seatsAvailable !== null ? String(source.seatsAvailable) : '',
    attachedBath: source.attachedBath,
    attachedBalcony: source.attachedBalcony,
    serviceChargeIncluded: source.serviceChargeIncluded,
    advanceMonths: source.advanceMonths !== null ? String(source.advanceMonths) : '',
    amenities: source.amenities,
    mealsProvided: source.mealsProvided,
    availableMonth: source.availableMonth ?? '',
    contactName: source.contactName ?? defaultContactName,
    contactPhone: source.contactPhone ?? defaultContactPhone,
    contactWhatsapp: source.contactWhatsapp ?? '',
    whatsappSameAsPhone: !source.contactWhatsapp || source.contactWhatsapp === source.contactPhone,
    contactFacebook: source.contactFacebook ?? '',
    hasContact2: Boolean(source.contact2Name || source.contact2Phone || source.contact2Facebook),
    contact2Name: source.contact2Name ?? '',
    contact2Phone: source.contact2Phone ?? '',
    contact2Whatsapp: source.contact2Whatsapp ?? '',
    contact2WhatsappSameAsPhone: !source.contact2Whatsapp || source.contact2Whatsapp === source.contact2Phone,
    contact2Facebook: source.contact2Facebook ?? '',
    sourceUrl: source.sourceUrl ?? '',
    expiryDays: toLetConfig.defaultExpiryDays,
    images: source.images
  };
}

export function useToLetForm({
  open,
  listing,
  prefillFrom,
  importedFields,
  defaultContactName,
  defaultContactPhone,
  onSaved,
  onClose
}: {
  open: boolean;
  listing?: CommunityMessageView | null;
  prefillFrom?: CommunityMessageView | null;
  importedFields?: Partial<ToLetFormState> | null;
  defaultContactName: string;
  defaultContactPhone: string;
  onSaved: (listing: CommunityMessageView) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ToLetFormState>(() => emptyForm(defaultContactName, defaultContactPhone));
  const [maxImageBytes, setMaxImageBytes] = useState(uploadConfig.maxImageBytes);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<GeoSuggestion[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editing = Boolean(listing);
  const reposting = !editing && Boolean(prefillFrom);
  const source = listing ?? prefillFrom ?? null;
  const isBachelor = form.tenantRestriction === TOLET_TENANT_RESTRICTION.BACHELOR;

  useEffect(() => {
    if (!open) return;
    setForm(
      source
        ? formFromSource(source, defaultContactName, defaultContactPhone)
        : { ...emptyForm(defaultContactName, defaultContactPhone), ...importedFields }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, defaultContactName, defaultContactPhone]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings')
      .then((res) => res.json())
      .then((body) => {
        const configured = Number(body?.settings?.maxProfileImageBytes);
        if (!cancelled && Number.isFinite(configured) && configured > 0) setMaxImageBytes(configured);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isBachelor && form.listingType === TOLET_TYPES.SEAT) {
      setForm((current) => ({ ...current, listingType: TOLET_TYPE_VALUES.find((type) => type !== TOLET_TYPES.SEAT) ?? TOLET_TYPE_VALUES[0] }));
    }
  }, [isBachelor, form.listingType]);

  useEffect(() => {
    return () => {
      if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current);
    };
  }, []);

  function update<K extends keyof ToLetFormState>(key: K, value: ToLetFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function searchLocationSuggestions(query: string) {
    if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current);

    if (query.trim().length < LOCATION_SEARCH_MIN_LENGTH) {
      setLocationSuggestions([]);
      setSearchingLocation(false);
      return;
    }

    setSearchingLocation(true);
    locationSearchTimer.current = setTimeout(() => {
      api
        .get<{ results: GeoSuggestion[] }>('/api/community/messages/location-search', { query: { q: query } })
        .then((data) => setLocationSuggestions(data.results))
        .catch(() => setLocationSuggestions([]))
        .finally(() => setSearchingLocation(false));
    }, LOCATION_SEARCH_DEBOUNCE_MS);
  }

  function updateLocation(value: string) {
    update('location', value);
    searchLocationSuggestions(value);
  }

  function selectLocationSuggestion(suggestion: GeoSuggestion) {
    setForm((current) => ({ ...current, location: suggestion.label, latitude: suggestion.lat, longitude: suggestion.lng }));
    setLocationSuggestions([]);
  }

  function addContact2() {
    update('hasContact2', true);
  }

  function removeContact2() {
    setForm((current) => ({
      ...current,
      hasContact2: false,
      contact2Name: '',
      contact2Phone: '',
      contact2Whatsapp: '',
      contact2WhatsappSameAsPhone: true,
      contact2Facebook: ''
    }));
  }

  function toggleAmenity(amenity: string) {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity]
    }));
  }

  function shareLocation() {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      toast.error(strings.toLet.location.insecureContext);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(strings.toLet.location.unsupported);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setForm((current) => ({ ...current, latitude, longitude }));

        api
          .get<{ label: string | null }>('/api/community/messages/reverse-geocode', { query: { lat: latitude, lng: longitude } })
          .then((data) => {
            if (data.label) update('location', data.label);
          })
          .catch(() => undefined)
          .finally(() => setLocating(false));
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) toast.error(strings.toLet.location.permissionDenied);
        else if (error.code === error.POSITION_UNAVAILABLE) toast.error(strings.toLet.location.unavailable);
        else if (error.code === error.TIMEOUT) toast.error(strings.toLet.location.timedOut);
        else toast.error(strings.toLet.location.shareFailed);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function clearSharedLocation() {
    setForm((current) => ({ ...current, latitude: null, longitude: null }));
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const room = toLetConfig.maxImagesPerListing - form.images.length;
    if (room <= 0) {
      toast.error(strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
      return;
    }

    const accepted: File[] = [];
    for (const file of files.slice(0, room)) {
      if (!ACCEPTED_IMAGE_MIMES.includes(file.type)) {
        toast.error(strings.uploads.imageWrongType);
        continue;
      }
      if (file.size > maxImageBytes) {
        toast.error(strings.uploads.imageTooLarge(formatBytes(maxImageBytes)));
        continue;
      }
      accepted.push(file);
    }
    if (files.length > room) {
      toast.error(strings.toLet.tooManyPhotos(toLetConfig.maxImagesPerListing));
    }

    try {
      const dataUrls = await Promise.all(accepted.map(readAsDataUrl));
      update('images', [...form.images, ...dataUrls]);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function removeImage(index: number) {
    update(
      'images',
      form.images.filter((_, i) => i !== index)
    );
  }

  async function submit() {
    if (saving) return;
    if (!form.title.trim() || !form.text.trim() || !form.location.trim()) return;

    setSaving(true);
    try {
      const payload = {
        listingType: form.listingType,
        title: form.title.trim(),
        text: form.text.trim(),
        rent: form.rent.trim() ? Number(form.rent) : null,
        rentNegotiable: form.rentNegotiable,
        location: form.location.trim(),
        latitude: form.latitude,
        longitude: form.longitude,
        genderPreference: isBachelor ? form.genderPreference : null,
        tenantRestriction: form.tenantRestriction,
        houseRules: isBachelor ? form.houseRules : null,
        isSublet: form.isSublet,
        seatsAvailable: form.seatsAvailable ? Number(form.seatsAvailable) : null,
        attachedBath: form.attachedBath,
        attachedBalcony: form.attachedBalcony,
        serviceChargeIncluded: form.serviceChargeIncluded,
        advanceMonths: form.advanceMonths ? Number(form.advanceMonths) : null,
        amenities: form.amenities,
        mealsProvided: form.mealsProvided,
        availableMonth: form.availableMonth || null,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactWhatsapp: form.whatsappSameAsPhone ? form.contactPhone.trim() || null : form.contactWhatsapp.trim() || null,
        contactFacebook: form.contactFacebook.trim() || null,
        contact2Name: form.hasContact2 ? form.contact2Name.trim() || null : null,
        contact2Phone: form.hasContact2 ? form.contact2Phone.trim() || null : null,
        contact2Whatsapp: form.hasContact2
          ? form.contact2WhatsappSameAsPhone
            ? form.contact2Phone.trim() || null
            : form.contact2Whatsapp.trim() || null
          : null,
        contact2Facebook: form.hasContact2 ? form.contact2Facebook.trim() || null : null,
        sourceUrl: form.sourceUrl.trim() || null,
        expiryDays: form.expiryDays,
        images: form.images
      };

      const data =
        editing && listing
          ? await api.patch<{ message: CommunityMessageView }>(`/api/community/messages/${listing.id}`, payload)
          : reposting && prefillFrom
            ? await api.post<{ message: CommunityMessageView }>(`/api/community/messages/${prefillFrom.id}/repost`, payload)
            : await api.post<{ message: CommunityMessageView }>('/api/community/messages', payload);

      onSaved(data.message);
      toast.success(editing ? strings.toLet.updated : reposting ? strings.toLet.reposted : strings.toLet.created);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const typeOptions = TOLET_TYPE_VALUES.filter((type) => isBachelor || type !== TOLET_TYPES.SEAT).map((type) => ({
    value: type,
    label: strings.toLet.types[type as keyof typeof strings.toLet.types]
  }));
  const genderOptions = TOLET_GENDER_PREFERENCE_VALUES.map((pref) => ({
    value: pref,
    label: strings.toLet.genderPreference[pref as keyof typeof strings.toLet.genderPreference]
  }));
  const amenityOptions = TOLET_AMENITY_VALUES.map((amenity) => ({
    value: amenity,
    label: strings.toLet.amenities[amenity as keyof typeof strings.toLet.amenities]
  }));
  const currentMonthIndex = new Date().getMonth();
  const upcomingMonths = [0, 1, 2].map((offset) => TOLET_MONTHS[(currentMonthIndex + offset) % 12]);
  const selectableMonths =
    form.availableMonth && !upcomingMonths.includes(form.availableMonth as (typeof TOLET_MONTHS)[number])
      ? [form.availableMonth as (typeof TOLET_MONTHS)[number], ...upcomingMonths]
      : upcomingMonths;
  const monthOptions = [
    { value: '', label: strings.toLet.composer.availableNowOption },
    ...selectableMonths.map((month) => ({ value: month, label: strings.toLet.months[month] }))
  ];
  const expiryOptions = toLetConfig.expiryOptionsDays.map((days) => ({
    value: String(days),
    label: strings.toLet.composer.expiryOption(days)
  }));
  const advanceOptions = [0, 1, 2, 3].map((months) => ({
    value: String(months),
    label: strings.toLet.composer.advanceMonthsOption(months)
  }));

  const canSubmit = Boolean(form.title.trim() && form.text.trim() && form.location.trim());
  const hasSharedLocation = form.latitude !== null && form.longitude !== null;

  return {
    form,
    update,
    updateLocation,
    locationSuggestions,
    searchingLocation,
    selectLocationSuggestion,
    addContact2,
    removeContact2,
    toggleAmenity,
    editing,
    reposting,
    saving,
    locating,
    hasSharedLocation,
    isBachelor,
    canSubmit,
    fileInput,
    addFiles,
    removeImage,
    shareLocation,
    clearSharedLocation,
    submit,
    typeOptions,
    genderOptions,
    amenityOptions,
    monthOptions,
    expiryOptions,
    advanceOptions
  };
}

export type ToLetFormApi = ReturnType<typeof useToLetForm>;
