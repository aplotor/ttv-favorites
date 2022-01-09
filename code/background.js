console.log("background");

chrome.runtime.onInstalled.addListener(async (details) => {
	try {
		const settings_initialized = (Object.keys(await chrome.storage.sync.get("settings")).length == 0 ? false : true);
		if (!settings_initialized) {
			await chrome.storage.sync.set({
				settings: {
					stars: true,
					hide: true
				}
			});
		}
	
		const settings = (await chrome.storage.sync.get("settings")).settings;
		console.log(settings);
	} catch (err) {
		console.error(err);
	}
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "favorites updated":
			try {
				const active_window = await chrome.windows.getLastFocused();
				const ttv_tabs = await chrome.tabs.query({
					url: "https://www.twitch.tv/*"
				});
				for (const tab of ttv_tabs) {
					if (!(tab.windowId == active_window.id && tab.active)) {
						chrome.tabs.sendMessage(tab.id, {
							subject: "favorites updated"
						});
					}
				}
			} catch (err) {
				console.error(err);
			}
			break;
		default:
			break;
	}
});

chrome.webNavigation.onCompleted.addListener((details) => {
	handle_navigation(details);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
	handle_navigation(details);
});

function handle_navigation(details) {
	if (details.frameId == 0) {
		const url = (details.url.endsWith("/") ? details.url.slice(0, -1) : details.url);
		console.log(url);
		if (url == "https://www.twitch.tv" || url.startsWith("https://www.twitch.tv/directory")) {
			chrome.tabs.sendMessage(details.tabId, {
				subject: "navigation",
				content: "non-channel"
			});
		} else if (url.startsWith("https://www.twitch.tv/")) {
			chrome.tabs.sendMessage(details.tabId, {
				subject: "navigation",
				content: "channel"
			});
		};
	}
}
