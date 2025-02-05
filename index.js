const { Bot, InlineKeyboard, Keyboard } = require('grammy')
const fs = require('fs')
const { Client } = require('pg')
require('dotenv').config()

const app = express()

// Бот продолжает работать нормально

let mode = 0

const startKey = new Keyboard().text('FLL').text('FTC').resized()

// Инициализация PostgreSQL
const db = new Client({
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_NAME,
	password: process.env.DB_PASSWORD,
	port: process.env.DB_PORT,
})

db.connect()

// Инициализация бота
const bot = new Bot(process.env.BotApiKey)

// Функция для загрузки языков из папки locales
const loadLanguages = path => {
	const languages = {}
	const files = fs.readdirSync(path)
	files.forEach(file => {
		const langCode = file.replace('.json', '') // Убираем расширение
		const langData = JSON.parse(fs.readFileSync(`${path}/${file}`, 'utf-8'))
		languages[langCode] = langData
	})
	return languages
}

// Загрузка всех языков из папки locales
const languages = loadLanguages('./locales')

// Функция для получения языка пользователя из базы
const getUserLanguage = async userId => {
	const res = await db.query('SELECT language FROM users WHERE user_id = $1', [
		userId,
	])
	return res.rows.length > 0 ? res.rows[0].language : null
}

// Функция для сохранения языка пользователя в базу
const setUserLanguage = async (userId, language) => {
	const res = await db.query(
		`INSERT INTO users (user_id, language) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET language = $2`,
		[userId, language]
	)
	return res
}

// Команда /start с выбором языка
bot.command('start', async ctx => {
	mode = 0
	const userId = ctx.from.id

	// Проверяем, есть ли у пользователя сохранённый язык
	const savedLanguage = await getUserLanguage(userId)
	if (savedLanguage) {
		ctx.reply(languages[savedLanguage].start, {
			reply_markup: startKey,
			input_field_placeholder: 'О чём бы хотели узнать?',
			disable_web_page_preview: true,
		})
		return ctx.reply(languages[savedLanguage].backQuestions)
	}

	// Отправляем клавиатуру с выбором языка
	const keyboard = new InlineKeyboard()
		.text('🇷🇺 Русский', 'lang_ru')
		.text('🇬🇧 English', 'lang_en')
		.text('🇰🇿 Қазақша', 'lang_kz')

	await ctx.reply(languages['en'].choose_language, {
		reply_markup: keyboard,
	})
})

// Обработка выбора языка
bot.callbackQuery(['lang_ru', 'lang_en', 'lang_kz'], async ctx => {
	const userId = ctx.from.id
	const chosenLang = ctx.callbackQuery.data.split('_')[1] // Получаем "ru", "en" или "kz"

	// Сохраняем язык пользователя в базу данных
	await setUserLanguage(userId, chosenLang)

	const lang = (await getUserLanguage(userId)) || 'en'

	// Отправляем подтверждение
	const message = languages[chosenLang].language_set.replace(
		'{language}',
		chosenLang === 'ru'
			? 'Русский'
			: chosenLang === 'en'
			? 'English'
			: 'Қазақша'
	)

	await ctx.answerCallbackQuery(message)
	await ctx.reply(languages[chosenLang].start, {
		reply_markup: startKey,
		input_field_placeholder: 'О чём бы хотели узнать?',
		disable_web_page_preview: true,
	})
})

// Команда /help
bot.command('help', async ctx => {
	const userId = ctx.from.id
	const lang = (await getUserLanguage(userId)) || 'en' // По умолчанию "en"
	await ctx.reply(languages[lang].help)
})

bot.on('message:text', async ctx => {
	const userId = ctx.from.id
	const lang = (await getUserLanguage(userId)) || 'en'
	let text = ctx.message.text.toLowerCase()
	console.log(languages[lang].FLLquestions[text])
	const keys = Object.keys(languages[lang])
	const fllKeys = Object.keys(languages[lang].FLLquestions)
	const ftcKeys = Object.keys(languages[lang].FTCquestions)
	console.log('the key', fllKeys)
	console.log(`mode: ${mode}`)

	// Функция для поиска ключа по введенному тексту
	function findInJson(keys, searchValue) {
		return keys.find(key => key.toLowerCase() === searchValue)
	}

	const fllKeyboard = new Keyboard()
		.text(fllKeys[0])
		.text(fllKeys[1])
		.row()
		.text(fllKeys[2])
		.text(fllKeys[3])
		.row()
		.text(fllKeys[4])
		.text(fllKeys[5])
		.row()
		.text(fllKeys[6])
		.text(fllKeys[7])
		.resized()
	const ftcKeyboard = new Keyboard()
		.text(ftcKeys[0])
		.text(ftcKeys[1])
		.row()
		.text(ftcKeys[2])
		.text(ftcKeys[3])
		.row()
		.text(ftcKeys[4])
		.text(ftcKeys[5])
		.row()
		.text(ftcKeys[6])
		.text(ftcKeys[7])
		.row()
		.text(ftcKeys[8])
		.resized()

	const foundKey = findInJson(keys, text) // Ищем ключ, который совпадает с введенным текстом
	text = ctx.message.text
	console.log('text', text)
	console.log('Something :: ', text === ftcKeys[8])
	if (foundKey) {
		if (foundKey === 'FLL') {
			ctx.reply(languages[lang][foundKey], {
				reply_markup: fllKeyboard,
			})
			mode = 1
		}
		if (foundKey === 'FTC') {
			ctx.reply(languages[lang][foundKey], {
				reply_markup: ftcKeyboard,
			})
			mode = 2
		}
		if (mode === 0) {
			ctx.reply(languages[lang][foundKey], {
				disable_web_page_preview: true,
			})
		}
	}
	if (mode === 1 || mode === 2) {
		if (text === fllKeys[7]) {
			mode = 0
			ctx.reply(languages[lang].backQuestions, {
				reply_markup: startKey,
				disable_web_page_preview: true,
			})
		}
		if (languages[lang].FLLquestions[text]) {
			const reply = languages[lang].FLLquestions[text]
			ctx.reply(reply, {
				disable_web_page_preview: true,
			})
		}
	}
	if (mode === 2) {
		if (text === ftcKeys[8]	) {
			mode = 0
			ctx.reply(languages[lang].backquestions, {
				reply_markup: startKey,
				disable_web_page_preview: true,
			})
		}
		if (languages[lang].FTCquestions[text]) {
			const reply = languages[lang].FTCquestions[text]
			ctx.reply(reply, {
				disable_web_page_preview: true,
			})
		}
	}
})

// Запуск бота
bot.start()
