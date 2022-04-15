console.log("popup");

let status = null;
let settings = null;

const stars_checkbox = document.getElementById("stars_checkbox");
const hide_checkbox = document.getElementById("hide_checkbox");
const save_btn = document.getElementById("save_btn");
const clear_favorites_btn = document.getElementById("clear_favorites_btn");
const cancel_confirm_btns_wrapper = document.getElementById("cancel_confirm_btns_wrapper");
const cancel_btn = document.getElementById("cancel_btn");
const confirm_btn = document.getElementById("confirm_btn");
const notice = document.getElementById("notice");

try {
	status = (await chrome.storage.local.get("status")).status;
	(status == "disabled" ? notice.classList.remove("d_none") : null);

	settings = (await chrome.storage.sync.get("settings")).settings;
	stars_checkbox.checked = settings.stars;
	hide_checkbox.checked = settings.hide;
} catch (err) {
	console.error(err);
}

stars_checkbox.addEventListener("change", async (evt) => {
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
				subject: "settings changed"
			}).catch((err) => null);
		}
	} catch (err) {
		console.error(err);
	}
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
	} catch (err) {
		console.error(err);
	}
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "status changed":
			(msg.content != status ? notice.classList.toggle("d_none") : null);
			break;
		default:
			break;
	}
});
