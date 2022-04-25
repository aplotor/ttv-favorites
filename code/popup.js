console.log("popup");

let [
	status,
	settings,
	favorites
] = [];

const stars_checkbox = document.getElementById("stars_checkbox");
const hide_checkbox = document.getElementById("hide_checkbox");
const save_btn = document.getElementById("save_btn");
const view_favorites_btn = document.getElementById("view_favorites_btn");
const hide_favorites_btn = document.getElementById("hide_favorites_btn");
const favorites_list = document.getElementById("favorites_list");
const clear_favorites_btn = document.getElementById("clear_favorites_btn");
const cancel_confirm_btns_wrapper = document.getElementById("cancel_confirm_btns_wrapper");
const cancel_btn = document.getElementById("cancel_btn");
const confirm_btn = document.getElementById("confirm_btn");
const notice = document.getElementById("notice");

function refresh_favorites_list() {
	favorites_list.innerHTML = "";

	for (const favorite of favorites) {
		favorites_list.insertAdjacentHTML("beforeend", `
			<li>${favorite}</li>
		`);
	}
}

try {
	status = (await chrome.storage.local.get("status")).status;
	(status == "disabled" ? notice.classList.remove("d_none") : null);

	const synced_storage = await chrome.storage.sync.get(null);

	settings = synced_storage.settings;
	stars_checkbox.checked = settings.stars;
	hide_checkbox.checked = settings.hide;

	delete synced_storage.settings;
	favorites = Object.keys(synced_storage).sort((a, b) => a.localeCompare(b, "en"));
	refresh_favorites_list();
} catch (err) {
	console.error(err);
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "favorites updated":
			const synced_storage = await chrome.storage.sync.get(null);		
			delete synced_storage.settings;
			favorites = Object.keys(synced_storage).sort((a, b) => a.localeCompare(b, "en"));
			refresh_favorites_list();
			break;
		case "status changed":
			(msg.content != status ? notice.classList.toggle("d_none") : null);
			break;
		default:
			break;
	}
});

stars_checkbox.addEventListener("change", (evt) => {
	settings.stars = evt.target.checked;
});

hide_checkbox.addEventListener("change", (evt) => {
	settings.hide = evt.target.checked;
});

save_btn.addEventListener("click", async (evt) => {
	try {
		await chrome.storage.sync.set({
			settings: settings
		});
	
		const ttv_tabs = await chrome.tabs.query({
			url: "https://www.twitch.tv/*"
		});
		for (const tab of ttv_tabs) {
			chrome.tabs.sendMessage(tab.id, {
				subject: "settings changed",
				content: null
			}).catch((err) => null);
		}
	} catch (err) {
		console.error(err);
	}
});

view_favorites_btn.addEventListener("click", (evt) => {
	evt.target.classList.add("d_none");
	hide_favorites_btn.classList.remove("d_none");
	favorites_list.classList.remove("d_none");
});

hide_favorites_btn.addEventListener("click", (evt) => {
	evt.target.classList.add("d_none");
	view_favorites_btn.classList.remove("d_none");
	favorites_list.classList.add("d_none");
});

clear_favorites_btn.addEventListener("click", (evt) => {
	cancel_confirm_btns_wrapper.classList.toggle("d_none");
});

cancel_btn.addEventListener("click", (evt) => {
	cancel_confirm_btns_wrapper.classList.add("d_none");
});

confirm_btn.addEventListener("click", async (evt) => {
	cancel_confirm_btns_wrapper.classList.add("d_none");

	try {
		const synced_settings = (await chrome.storage.sync.get("settings")).settings;
		await chrome.storage.sync.clear();
		await chrome.storage.sync.set({
			settings: synced_settings
		});
	
		const ttv_tabs = await chrome.tabs.query({
			url: "https://www.twitch.tv/*"
		});
		for (const tab of ttv_tabs) {
			chrome.tabs.sendMessage(tab.id, {
				subject: "favorites updated",
				content: "cleared"
			}).catch((err) => null);
		}

		favorites = [];
		refresh_favorites_list();
	} catch (err) {
		console.error(err);
	}
});
