console.log("background");

function handle_navigation(details) {
	if (details.frameId == 0 && details.url.startsWith("https://www.twitch.tv")) {
		chrome.tabs.sendMessage(details.tabId, {
			subject: "navigation",
			content: details.url
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

	const default_settings = {
		section: true,
		stars: true,
		hide: true
	};
	try {
		let settings = (await chrome.storage.sync.get("settings")).settings;
		(!settings ? settings = {} : null);
		for (const setting in default_settings) {
			(!(setting in settings) ? settings[setting] = default_settings[setting] : null);
		}
		console.log(settings);
		await chrome.storage.sync.set({
			settings: settings
		});
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
