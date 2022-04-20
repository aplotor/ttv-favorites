console.log("foreground");

const root = document.getElementsByClassName("root")[0];
if (root && !root.children[0].classList.contains("bGJmZt")) {
	chrome.storage.local.set({
		status: "disabled"
	}).catch((err) => console.error(err));

	chrome.runtime.sendMessage({
		subject: "status changed",
		content: "disabled"
	}).catch((err) => null);
	
	throw new Error("class names outdated");
}

let [
	settings,
	favorites,
	sidebar,
	favorite_channels_list,
	followed_channels_list,
	btns_section,
	last_channel_offline, // last visited channel
	current_channel_offline // currently visiting channel
] = [];

let ac = new AbortController();
let clicks_since_mouse_enter = 0;
let ctrl_key_down = false;

const star_indicator = create_element_from_html_string(`
	<span class="star_indicator">⭐</span>
`);
const red_dot_indicator = create_element_from_html_string(`
	<div class="ScChannelStatusIndicator-sc-1cf6j56-0 dtUsEc tw-channel-status-indicator" data-test-selector="0"></div>
`);

const sidebar_mo = new MutationObserver((mutations) => {
	sidebar = document.getElementsByClassName("side-bar-contents")[0].children[0].children[0];
	const followed_channels_section = sidebar.children[0];
	if (sidebar && followed_channels_section) {
		sidebar_mo.disconnect();

		const favorite_channels_section = followed_channels_section.cloneNode(true);
		favorite_channels_section.setAttribute("aria-label", "Favorite Channels");
		favorite_channels_section.children[0].children[1].children[0].innerHTML = "FAVORITE CHANNELS";
		favorite_channels_section.children[1].id = "favorite_channels_list";
		favorite_channels_section.children[2].remove();

		sidebar.prepend(favorite_channels_section);
		favorite_channels_list = document.getElementById("favorite_channels_list");

		cycle_update_channels_lists();
	}
});

const channel_mo = new MutationObserver((mutations) => {
	const _ = document.getElementsByClassName("ScCoreButton-sc-1qn4ixc-0 ScCoreButtonSecondary-sc-1qn4ixc-2 ffyxRu kgzEiA")[1];
	const customize_channel_btn = (_ && _.href && _.href.startsWith("https://dashboard.twitch.tv/u/") && _.href.endsWith("/settings/channel") ? _ : null);

	const follow_btn = document.querySelector('[data-a-target="follow-button"]');
	const unfollow_btn = document.querySelector('[data-a-target="unfollow-button"]');

	if (customize_channel_btn || follow_btn || unfollow_btn) {
		channel_mo.disconnect();
		remove_star_btn();

		last_channel_offline = current_channel_offline;
		current_channel_offline = (document.getElementsByClassName("home")[0] ? true : false);

		btns_section = document.getElementsByClassName("Layout-sc-nxg1ff-0 eNUtIR")[0];

		if (unfollow_btn) {
			add_margin_to_squad_mode_btn();

			if (last_channel_offline) {
				setTimeout(() => { // wait for ttv to replace btns_section
					btns_section = document.getElementsByClassName("Layout-sc-nxg1ff-0 eNUtIR")[0]; // need to get this again bc ttv removes the previously retrieved one when going from offline channel to live channel
					add_star_btn().catch((err) => console.error(err));
				}, 2500);
			} else {
				add_star_btn().catch((err) => console.error(err));
			}
		}
	}
});

const debounced_apply_settings_to_followed_channels_list = create_debounced_function(() => {
	for (const channel of followed_channels_list.children) {
		const channel_live = (channel.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true);
		if (channel_live) {
			const channel_name = channel.children[0].children[0].children[0].children[1].children[0].children[0].children[0].title.split(" ")[0];
			(favorites.has(channel_name) ? apply_settings_to_channel(channel, "followed") : remove_applied_settings_from_channel(channel));
		}
	}
}, 50);
const followed_channels_list_mo = new MutationObserver((mutations) => {
	debounced_apply_settings_to_followed_channels_list();
});

window.addEventListener("click", (evt) => {
	if (evt.target.closest('[data-a-target="follow-button"]')) {
		add_margin_to_squad_mode_btn();
		add_star_btn().catch((err) => console.error(err));
	} else if (evt.target.closest('[data-a-target="unfollow-button"]')) {
		remove_star_btn();
		remove_margin_from_squad_mode_btn();
	}
});

window.addEventListener("keydown", (evt) => {
	if (evt.key == "Control") {
		ctrl_key_down = true;
		setTimeout(() => {
			ctrl_key_down = false;
		}, 250);
	}
});
window.addEventListener("keyup", (evt) => {
	(evt.key == "Control" ? ctrl_key_down = false : null);
});

chrome.storage.sync.get(null, (items) => {
	settings = items.settings;
	console.log(settings);

	delete items.settings;
	favorites = new Set([...Object.keys(items)]);
	console.log(favorites);
});

sidebar_mo.observe(document, {
	attributes: true,
	childList: true,
	subtree: true
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
	console.log(msg);
	switch (msg.subject) {
		case "navigation":
			channel_mo.disconnect();
			if (document.getElementsByClassName("channel-root__player")[0]) {
				console.log("channel");

				channel_mo.observe(document, {
					attributes: true,
					childList: true,
					subtree: true
				});
			} else {
				console.log("not channel");
			}
			break;
		case "favorites updated":
			try {
				const synced_storage = await chrome.storage.sync.get(null);
				delete synced_storage.settings;
				favorites = new Set([...Object.keys(synced_storage)]);
				
				(document.getElementById("star_btn") ? refresh_star_btn().catch((err) => console.error(err)) : null);
	
				(document.getElementById("sideNav") ? update_channels_lists() : null);
			} catch (err) {
				console.error(err);
			}
			break;
		case "settings changed":
			try {
				settings = (await chrome.storage.sync.get("settings")).settings;
				update_channels_lists();
			} catch (err) {
				console.error(err);
			}
			break;
		default:
			break;
	}
});

function get_current_channel_name() {
	const channel_name_wrapper = document.getElementsByClassName("CoreText-sc-cpl358-0 ScTitleText-sc-1gsen4-0 fiLmJS gasGNr InjectLayout-sc-588ddc-0 idDHLE tw-title")[0] || document.getElementsByClassName("CoreText-sc-cpl358-0 ScTitleText-sc-1gsen4-0 cyfUN gasGNr tw-title")[0]; // for live or offline, respectively
	const channel_name = channel_name_wrapper.innerHTML;
	return channel_name;
}

function add_margin_to_squad_mode_btn() {
	const element = document.getElementsByClassName("metadata-layout__secondary-button-spacing")[0];
	if (element && element.hasChildNodes()) {
		const squad_mode_btn = element.children[0];
		squad_mode_btn.style.marginRight = "3em";
	}
}

function remove_margin_from_squad_mode_btn() {
	const element = document.getElementsByClassName("metadata-layout__secondary-button-spacing")[0];
	if (element && element.hasChildNodes()) {
		const squad_mode_btn = element.children[0];
		squad_mode_btn.style.marginRight = 0;
	}
}

async function add_star_btn() {
	const channel_name = get_current_channel_name();

	let star_btn = create_element_from_html_string(`
		<button id="star_btn" class="${"btn_" + document.getElementsByTagName("html")[0].classList[2].split("tw-root--theme-")[1]}" type="button">${(favorites.has(channel_name) ? "★" : "☆")}</button>
	`);
	document.querySelector('[data-target="channel-header-right"]').prepend(star_btn);

	star_btn = document.getElementById("star_btn");

	star_btn.addEventListener("mouseenter", (evt) => {
		(evt.target.innerHTML == "☆" ? evt.target.innerHTML = "★" : evt.target.innerHTML = "☆");
	});

	star_btn.addEventListener("mouseleave", (evt) => {
		(evt.target.innerHTML == "☆" ? evt.target.innerHTML = "★" : evt.target.innerHTML = "☆");
	}, {
		signal: ac.signal
	});

	star_btn.addEventListener("click", async (evt) => {
		clicks_since_mouse_enter++;

		ac.abort();
		ac = new AbortController();

		star_btn.addEventListener("mouseleave", (evt) => {
			clicks_since_mouse_enter = 0;

			star_btn.addEventListener("mouseleave", (evt) => {
				(evt.target.innerHTML == "☆" ? evt.target.innerHTML = "★" : evt.target.innerHTML = "☆");
			}, {
				signal: ac.signal
			});
		}, {
			once: true
		});

		try {
			(favorites.has(channel_name) ? await remove_favorite(channel_name) : await add_favorite(channel_name));
		} catch (err) {
			console.error(err);
		}
		
		if (clicks_since_mouse_enter > 1) {
			(evt.target.innerHTML == "☆" ? evt.target.innerHTML = "★" : evt.target.innerHTML = "☆");
		}
	});

	const btns_section_mo = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.removedNodes) {
				if (node.contains(btns_section)) {
					btns_section_mo.disconnect();
					console.log("ttv removed btns_section");
				}
			}
		}
	});
	btns_section_mo.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	});
}

function remove_star_btn() {
	const star_btn = document.getElementById("star_btn");
	(star_btn ? star_btn.remove() : null);
}

async function refresh_star_btn() {
	try {
		remove_star_btn();
		await add_star_btn();
	} catch (err) {
		console.error(err);
	}
}

async function add_favorite(channel_name) {
	favorites.add(channel_name);
	update_channels_lists();
	
	await chrome.storage.sync.set({
		[channel_name]: null // value doesnt matter, only need key existence
	});
	console.log(`favorited (${channel_name})`);
	chrome.runtime.sendMessage({
		subject: "favorites updated",
		content: "added"
	}).catch((err) => null);
}

async function remove_favorite(channel_name) {
	favorites.delete(channel_name);
	update_channels_lists();

	await chrome.storage.sync.remove(channel_name);
	console.log(`unfavorited (${channel_name})`);
	chrome.runtime.sendMessage({
		subject: "favorites updated",
		content: "removed"
	}).catch((err) => null);
}

function update_channels_lists() {
	console.log("update_channels_lists started");
	
	followed_channels_list_mo.disconnect();
	followed_channels_list = sidebar.children[1].children[1]; // need to get this per cycle bc ttv occasionally freezes the followed channels list (i.e., makes it inactive) and uses a new active one
	followed_channels_list_mo.observe(followed_channels_list, {
		attributes: true,
		childList: true,
		subtree: true
	});

	const show_more_times_clicked = expand_followed_channels_list();

	const num_existing_channels = favorite_channels_list.children.length;
	let num_replaced_channels = 0;
	for (const channel of followed_channels_list.children) {
		const channel_live = (channel.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true);
		if (channel_live) {
			const channel_name = channel.children[0].children[0].children[0].children[1].children[0].children[0].children[0].title.split(" ")[0];
			if (favorites.has(channel_name)) {
				const channel_clone = channel.cloneNode(true);
				configure_channel_clone(channel_clone);
				
				(num_replaced_channels < num_existing_channels ? favorite_channels_list.children[num_replaced_channels++].replaceWith(channel_clone) : favorite_channels_list.append(channel_clone));
			}
		} else {
			break;
		}
	}

	const num_leftover_channels = num_existing_channels - num_replaced_channels;
	for (let i = 0; i < num_leftover_channels; i++) {
		const last_element = [...favorite_channels_list.children].at(-1);
		last_element.remove();
	}

	unexpand_followed_channels_list(show_more_times_clicked);

	console.log("update_channels_lists completed");
}
function cycle_update_channels_lists() {
	update_channels_lists();

	setInterval(() => {
		update_channels_lists();
	}, 30000);
}

function expand_followed_channels_list() {
	let element = document.querySelector('[data-a-target="side-nav-show-more-button"]');
	let show_more_btn = (element && element.parentElement.parentElement == followed_channels_list.parentElement ? element : null); // the one for followed channels
	let last_element = [...followed_channels_list.children].at(-1); // the last element of followed_channels_list
	let last_channel_live = (last_element.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true); // whether the channel corresponding w last_element is live or not

	let show_more_times_clicked = 0;
	while (show_more_btn && last_channel_live) {
		show_more_btn.click();
		show_more_times_clicked++;
		
		element = document.querySelector('[data-a-target="side-nav-show-more-button"]');
		show_more_btn = (element && element.parentElement.parentElement == followed_channels_list.parentElement ? element : null);
		last_element = [...followed_channels_list.children].at(-1);
		last_channel_live = (last_element.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true);
	}
	console.log(`show more clicked (${show_more_times_clicked}) time${(show_more_times_clicked == 1 ? "" : "s")}`);

	return show_more_times_clicked;
}

function unexpand_followed_channels_list(show_more_times_clicked) {
	let show_less_times_clicked = 0;
	if (show_more_times_clicked > 0) {
		const show_less_btn = document.querySelector('[data-a-target="side-nav-show-less-button"]'); // the one for followed channels

		for (let i = 0; i < show_more_times_clicked; i++) {
			show_less_btn.click();
			show_less_times_clicked++;
		}
	}
	console.log(`show less clicked (${show_less_times_clicked}) time${(show_less_times_clicked == 1 ? "" : "s")}`);
}

function apply_settings_to_channel(channel, for_list) {
	const channel_indicator = channel.children[0].children[0].children[0].children[1].children[1].children[0].children[0];
	channel_indicator.replaceWith((settings.stars == true ? star_indicator.cloneNode(true) : red_dot_indicator.cloneNode(true)));

	switch (for_list) {
		case "favorite":
			(channel.classList.contains("d_none") ? channel.classList.remove("d_none") : null); // in case followed_channels_list_mo added class d_none to channel before it was cloned
			break;
		case "followed":
			if (settings.hide == true) {
				(!channel.classList.contains("d_none") ? channel.classList.add("d_none") : null);
			} else {
				(channel.classList.contains("d_none") ? channel.classList.remove("d_none") : null);
			}
			break;
		default:
			break;
	}
}

function remove_applied_settings_from_channel(channel) {
	const channel_indicator = channel.children[0].children[0].children[0].children[1].children[1].children[0].children[0];
	channel_indicator.replaceWith(red_dot_indicator.cloneNode(true));

	(channel.classList.contains("d_none") ? channel.classList.remove("d_none") : null);
}

function configure_channel_clone(channel_clone) {
	apply_settings_to_channel(channel_clone, "favorite");

	const channel_clone_name = channel_clone.children[0].children[0].children[0].children[1].children[0].children[0].children[0].title.split(" ")[0];

	channel_clone.addEventListener("click", (evt) => { // need this for client-side routing bc fsr even with deep clone, clicking on channel_clone by default does a full page reload
		evt.preventDefault();

		if (ctrl_key_down) {
			const channel_url = channel_clone.children[0].children[0].children[0].href;
			window.open(channel_url, "_blank");
		} else {
			const show_more_times_clicked = expand_followed_channels_list();

			for (const channel of followed_channels_list.children) {
				const channel_name = channel.children[0].children[0].children[0].children[1].children[0].children[0].children[0].title.split(" ")[0];
				if (channel_name == channel_clone_name) {
					const channel_anchor = channel.children[0].children[0].children[0];
					channel_anchor.click();
					break;
				}
			}
	
			unexpand_followed_channels_list(show_more_times_clicked);
		}
	});
}

function create_element_from_html_string(html_string) {
	const dummy = document.createElement("div");
	dummy.innerHTML = html_string;
	const element = dummy.children[0];
	return element;
}

function create_debounced_function(fn, timeout) {
	let timer = null;
	return () => {
		(timer ? clearTimeout(timer) : null);
		timer = setTimeout(() => {
			fn.apply(this, arguments);
		}, timeout);
	};
}
