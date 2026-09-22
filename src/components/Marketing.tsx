import { useEffect, useState, type FormEvent } from 'react'
import { Activity, ArrowRight, BarChart3, Check, ChevronRight, CircleHelp, Heart, Mail, Menu, ShoppingBasket, Sparkles, Sprout, Target, Utensils, X } from 'lucide-react'
import { api } from '../api'
import { errorText, Logo } from './ui'
import '../marketing.css'

const features = [
  { icon: Utensils, name: 'Питание', text: 'Дневник, рецепты, порции и понятный подсчёт калорий и БЖУ.', color: 'lime' },
  { icon: Activity, name: 'Тренировки', text: 'Программы, подходы и история занятий — в твоём темпе.', color: 'peach' },
  { icon: Heart, name: 'Привычки', text: 'Вода, сон, движение и свои ритуалы, которые хочется повторять.', color: 'lavender' },
  { icon: BarChart3, name: 'Прогресс', text: 'Вес, замеры и наблюдения складываются в честную историю.', color: 'sky' },
  { icon: ShoppingBasket, name: 'Покупки', text: 'Список продуктов собирается из плана питания сам.', color: 'sun' },
]

function track(event: string) { api('/api/public/events', 'POST', { event }).catch(() => {}) }

export default function Marketing() {
  const [open, setOpen] = useState(false)
  useEffect(() => { track('landing_view') }, [])
  const close = () => setOpen(false)
  return <div className="marketing">
    <header className="marketing-nav">
      <a href="/" aria-label="TELO365 — главная"><Logo /></a>
      <nav aria-label="Основная навигация" className={open ? 'is-open' : ''}>
        <a href="#features" onClick={close}>Возможности</a><a href="#inside" onClick={close}>Как это выглядит</a><a className="marketing-login" href="/login">Войти</a>
      </nav>
      <a className="marketing-nav-cta" href="/register" onClick={() => track('nav_start')}>Начать бесплатно</a>
      <button className="marketing-menu" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </header>

    <main>
      <section className="marketing-hero" id="start">
        <div className="marketing-hero-copy"><span className="marketing-kicker"><Sparkles size={14} /> Тело в своём ритме</span><h1>Твоё тело.<br/><em>Каждый день.</em></h1><p>Питание, движение, полезные привычки и прогресс — в одном спокойном, понятном месте.</p><div className="marketing-actions"><a className="marketing-primary" href="/register" onClick={() => track('hero_start')}>Начать сегодня <ArrowRight size={18}/></a><a className="marketing-secondary" href="#features">Посмотреть возможности <ChevronRight size={17}/></a></div><span className="marketing-assurance"><Check size={15}/> Свой темп. Без запретов и гонки.</span></div>
        <div className="marketing-hero-visual" aria-hidden="true"><div className="hero-glow"/><div className="hero-photo"/><div className="hero-note">Маленькие шаги.<br/>Настоящий прогресс. <Heart size={17}/></div><div className="hero-score"><span>Сегодня</span><strong>5 из 6</strong><small>маленьких шагов</small><div><i/><i/><i/><i/><i/><i className="empty"/></div></div></div>
      </section>

      <section className="marketing-intro"><p>Не очередной план, который нужно выдержать.</p><h2>Пространство, где <span>забота о себе</span> становится частью обычного дня.</h2></section>

      <section className="marketing-features" id="features"><div className="marketing-section-head"><span className="marketing-kicker">Всё нужное рядом</span><h2>Меньше сложных решений.<br/>Больше понятных действий.</h2></div><div className="marketing-feature-grid">{features.map(({ icon: Icon, name, text, color }, index) => <article className={`marketing-feature ${color}`} key={name}><span className="marketing-feature-number">0{index + 1}</span><span className="marketing-icon"><Icon /></span><h3>{name}</h3><p>{text}</p><a href="/register" onClick={() => track(`feature_${index + 1}`)}>Подробнее <ArrowRight size={15}/></a></article>)}</div></section>

      <section className="marketing-preview" id="inside"><div className="marketing-preview-copy"><span className="marketing-kicker">Твой личный кабинет</span><h2>Видеть картину.<br/><span>Выбирать следующий шаг.</span></h2><p>TELO365 не оценивает тебя. Он помогает замечать то, что уже получается, и бережно возвращаться к своему плану.</p><ul><li><Check/> Все записи синхронизируются между телефоном и компьютером.</li><li><Check/> История остаётся твоей и доступна только после входа.</li><li><Check/> Начни с одной привычки, веса или сегодняшнего приёма пищи.</li></ul><a className="marketing-text-link" href="/demo" onClick={() => track('preview_demo')}>Открыть пример кабинета <ArrowRight size={17}/></a></div><DashboardPreview /></section>

      <section className="marketing-steps"><div><span className="marketing-kicker">Без сложного старта</span><h2>Один день — уже начало.</h2></div><ol><li><b>01</b><span><strong>Выбери цель</strong><small>Например, больше энергии или спокойный контроль веса.</small></span></li><li><b>02</b><span><strong>Сделай первую запись</strong><small>Отметь воду, завтрак, прогулку или текущий вес.</small></span></li><li><b>03</b><span><strong>Возвращайся к себе</strong><small>Смотри на историю и продолжай в своём ритме.</small></span></li></ol></section>

      <section className="marketing-cta"><div><span className="marketing-kicker">TELO365</span><h2>Больше, чем фитнес.<br/><span>Это образ жизни.</span></h2><p>Создай свой кабинет и начни с сегодняшнего дня.</p></div><a className="marketing-primary" href="/register" onClick={() => track('footer_start')}>Создать аккаунт <ArrowRight size={18}/></a></section>
    </main>
    <Footer />
  </div>
}

function DashboardPreview() { return <div className="dashboard-preview" aria-label="Пример личного кабинета"><div className="preview-top"><span className="preview-brand"><Sprout/> TELO<span>365</span></span><span>Мой день</span><div className="preview-avatar">А</div></div><div className="preview-columns"><aside><small>Сегодня</small><b className="active">Главная</b><b>Питание</b><b>Тренировки</b><b>Прогресс</b><b>Привычки</b></aside><div className="preview-main"><div className="preview-welcome"><span>ПОНЕДЕЛЬНИК, 24 МАРТА</span><h3>Доброе утро, Анна</h3><p>Твоё тело благодарит за заботу.</p><a href="/register">Продолжить день <ArrowRight size={13}/></a></div><div className="preview-cards"><section><small>Питание на сегодня</small><strong>1 420 <em>ккал</em></strong><div className="preview-meter"><i/></div><span>Осталось 580 ккал</span></section><section><small>Привычки</small><strong>4 <em>из 5</em></strong><div className="preview-dots"><i/><i/><i/><i/><i className="off"/></div><span>Отличный ритм</span></section></div><section className="preview-chart"><div><small>Прогресс веса</small><strong>68,2 кг</strong></div><svg viewBox="0 0 320 86" role="img" aria-label="График снижения веса"><path d="M0 15H320M0 43H320M0 71H320"/><polyline points="0,15 42,25 82,31 125,44 168,48 208,60 250,64 284,70 320,67"/><circle cx="320" cy="67" r="4"/></svg></section></div></div></div> }

export function LegalPage({ page }: { page: 'about' | 'privacy' | 'terms' | 'contacts' }) {
  const content = legal[page]
  useEffect(() => { track(`legal_${page}`) }, [page])
  return <div className="legal-shell"><header className="legal-nav"><a href="/"><Logo /></a><a href="/" className="marketing-text-link">На главную <ArrowRight size={16}/></a></header><main className="legal-content"><span className="marketing-kicker">TELO365 · {content.label}</span><h1>{content.title}</h1><p className="legal-lead">{content.lead}</p>{page === 'contacts' ? <ContactForm /> : content.sections.map(section => <section key={section.title} id={'id' in section?section.id:undefined}><h2>{section.title}</h2><p>{section.text}</p></section>)}</main><Footer /></div>
}

function ContactForm() { const [state, setState] = useState<'idle' | 'sent'>('idle'), [error, setError] = useState(''); async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(''); const data = new FormData(e.currentTarget); try { await api('/api/public/feedback', 'POST', { name: data.get('name'), email: data.get('email'), message: data.get('message') }); setState('sent'); track('feedback_sent') } catch (reason) { setError(errorText(reason)) } } if (state === 'sent') return <div className="contact-success"><Check/><h2>Сообщение отправлено</h2><p>Спасибо. Мы прочитаем его и ответим на указанный адрес, когда подключим внешнюю доставку почты.</p></div>; return <form className="contact-form" onSubmit={submit}><label>Как к вам обращаться<input name="name" maxLength={80} required autoComplete="name"/></label><label>Email для ответа<input name="email" type="email" maxLength={254} required autoComplete="email"/></label><label>Сообщение<textarea name="message" maxLength={2500} required rows={6} placeholder="Расскажите, что хотите видеть в TELO365"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="marketing-primary">Отправить сообщение <ArrowRight size={17}/></button><small>Отправляя форму, вы соглашаетесь с <a href="/privacy">политикой конфиденциальности</a>.</small></form> }

function Footer() { return <footer className="marketing-footer"><a href="/"><Logo /></a><div className="marketing-footer-links"><a href="/about">О сервисе</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия использования</a><a href="/contacts">Контакты</a><a href="/contacts">Поддержка</a></div><small>© {new Date().getFullYear()} TELO365</small></footer> }

const legal = {
  about: { label: 'О сервисе', title: 'TELO365 — пространство для ежедневной заботы о себе', lead: 'Мы создаём спокойный инструмент для тех, кто хочет лучше понимать своё тело без жёстких правил и бесконечных таблиц.', sections: [{ title: 'Зачем нужен TELO365', text: 'Сервис объединяет питание, тренировки, привычки, вес и покупки. Он помогает увидеть связь между небольшими действиями и самочувствием, а не требует идеального результата.' }, { title: 'Как развиваем сервис', text: 'Сейчас доступна ранняя версия. Мы постепенно добавляем функции, ориентируясь на реальные ежедневные задачи пользователей. Материалы в каталоге носят справочный характер и не заменяют консультацию врача или тренера.' }] },
  privacy: {
    label: 'Политика конфиденциальности',
    title: 'Как мы обращаемся с данными',
    lead: 'Здесь описано, какие данные сохраняет TELO365 и как ими можно управлять.',
    sections: [
      { title: 'Какие данные сохраняются', text: 'При регистрации сохраняются email, имя и технические данные для входа. В аккаунте могут храниться данные, которые вы добавляете сами: питание, тренировки, вес, привычки, покупки и ответы стартовой анкеты. Сведения о физических ограничениях хранятся только при отдельном согласии.' },
      { id: 'health-data', title: 'Данные о здоровье и ограничениях', text: 'Если вы добровольно заполняете анкету о физических ограничениях, TELO365 может сохранить указанные вами сведения о боли, травмах, ограничениях движения, рекомендациях специалиста и факторах, которые важно учитывать при физической нагрузке. Эти данные используются только для адаптации тренировок: чтобы не предлагать заведомо неподходящую нагрузку или интенсивность. TELO365 не ставит диагнозы, не назначает лечение и не изменяет назначения врача. При острой боли или запрете специалиста сервис ограничивает автоматические тренировочные рекомендации.' },
      { title: 'Отдельное согласие и контроль', text: 'Данные этого раздела обрабатываются только после отдельного согласия. В профиле их можно удалить без удаления аккаунта: после этого сведения перестают использоваться для новых тренировочных рекомендаций. Мы рекомендуем не указывать названия препаратов, диагнозы и другие медицинские сведения, если они не нужны для адаптации нагрузки.' },
      { title: 'Зачем они нужны', text: 'Данные нужны для работы личного кабинета, синхронизации между устройствами и восстановления доступа. Мы ведём внутренние суммарные счётчики общих событий на сайте. Рекламные и сторонние аналитические трекеры не подключены.' },
      { title: 'Фото блюд', text: 'Если вы сами отправляете фото блюда на распознавание, оно передаётся OpenAI для подготовки ориентировочной оценки состава и КБЖУ. TELO365 не сохраняет такие фотографии. Проверьте оценку перед добавлением в дневник.' },
      { title: 'Ваш контроль', text: 'В профиле можно выгрузить данные, изменить стартовую анкету, удалить сведения о физических ограничениях или удалить аккаунт. После удаления аккаунта активные записи и сессии удаляются. Резервные копии хранятся ограниченный срок для восстановления после технического сбоя.' }
    ]
  },
  terms: { label: 'Условия использования', title: 'Условия использования TELO365', lead: 'Используя сервис, вы соглашаетесь с этими простыми правилами.', sections: [{ title: 'Назначение сервиса', text: 'TELO365 помогает вести личные записи о питании, активности и привычках. Сервис не является медицинской организацией, не ставит диагнозы и не заменяет консультацию специалиста.' }, { title: 'Ваш аккаунт', text: 'Вы отвечаете за сохранность пароля и резервного кода. Нельзя использовать сервис для размещения незаконных материалов или для нарушения работы сайта.' }, { title: 'Ранняя версия', text: 'Функции могут меняться по мере развития продукта. Мы стараемся поддерживать доступность и резервное копирование, но рекомендуем периодически экспортировать важные записи.' }] },
  contacts: { label: 'Контакты', title: 'Напишите нам', lead: 'Идея, вопрос, найденная ошибка или пожелание — каждое сообщение помогает сделать TELO365 полезнее.', sections: [] },
} as const
