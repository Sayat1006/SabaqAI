export const SUBJECTS = [
  'Математика', 'Алгебра', 'Геометрия', 'Қазақ тілі', 'Қазақ әдебиеті', 'Орыс тілі', 'Орыс әдебиеті',
  'Ағылшын тілі', 'Дүниетану', 'Жаратылыстану', 'Биология', 'Химия', 'Физика', 'География',
  'Информатика', 'Қазақстан тарихы', 'Дүниежүзі тарихы', 'Құқық негіздері', 'Өзін-өзі тану',
  'Дене шынықтыру', 'Музыка', 'Бейнелеу өнері', 'Көркем еңбек',
];

export const VALUES = [
  { key: 'indep', label: 'Тәуелсіздік пен отаншылдық', desc: 'Отанға деген сүйіспеншілік, елдің тәуелсіздігі мен тарихын қастерлеу' },
  { key: 'unity', label: 'Бірлік пен ынтымақ', desc: 'Татулық, өзара құрмет және ынтымақтастықты дамыту' },
  { key: 'justice', label: 'Әділдік пен жауапкершілік', desc: 'Шынайылық, әділдік және өз ісіне жауапкершілікпен қарау' },
  { key: 'law', label: 'Заң мен тәртіп', desc: 'Ережелерді сақтау, қоғамдық тәртіп пен қауіпсіздік' },
  { key: 'work', label: 'Еңбекқорлық пен кәсіби біліктілік', desc: 'Еңбекке құрмет, білім мен дағдыны шыңдау' },
  { key: 'create', label: 'Жасампаздық пен жаңашылдық', desc: 'Шығармашылық ойлау, жаңа идеяларды қолдау және енгізу' },
];

export const PRESENTATION_STYLES = [
  { key: 'minimal', label: 'Минимал' },
  { key: 'colorful', label: 'Түрлі-түсті' },
  { key: 'science', label: 'Ғылыми' },
  { key: 'kids', label: 'Балаларға арналған' },
];

export const SLIDE_COUNTS = [5, 8, 10, 12];

export const IMAGE_STYLES = [
  { key: 'watercolor', label: 'Акварель', hint: 'soft watercolor look: translucent layered fills with low opacity, organic blob shapes, gentle color bleeding, no hard outlines' },
  { key: 'flat', label: 'Жалпақ дизайн', hint: 'flat design: solid fills, no gradients, simple geometric shapes, bold limited palette' },
  { key: 'realistic', label: 'Реалистік', hint: 'semi-realistic: linear/radial gradients for volume, soft shadows, detailed proportions' },
  { key: 'line', label: 'Сызықтық', hint: 'line art: consistent stroke outlines only, no fills or very light fills, minimalist' },
  { key: 'iso', label: 'Изометрия', hint: 'isometric 3D: 30-degree isometric projection, three shaded faces per object, clean geometric forms' },
];

export const catalog = {
  subjects: SUBJECTS,
  values: VALUES,
  presentationStyles: PRESENTATION_STYLES,
  slideCounts: SLIDE_COUNTS,
  imageStyles: IMAGE_STYLES.map(({ key, label }) => ({ key, label })),
};
