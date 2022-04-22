console.log("background");

function handle_navigation(details) {
	if (details.frameId == 0 && details.url.startsWith("https://www.twitch.tv")) {
		chrome.tabs.sendMessage(details.tabId, {
			subject: "navigation"
		}).catch((err) => null);
	}
}

chrome.runtime.onInstalled.addListener(async (details) => {
	chrome.storage.local.set({
		status: "enabled"
	}).catch((err) => console.error(err));

	chrome.runtime.sendMessage({
		subject: "status changed",
		content: "enabled"
	}).catch((err) => null);

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
							subject: "favorites updated",
							content: msg.content
						}).catch((err) => null);
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
