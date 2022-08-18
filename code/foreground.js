console.log("foreground");

let [
	settings,
	favorites,
	theme,
	followed_channels_section,
	favorite_channels_section,
	followed_channels_list,
	favorite_channels_list,
	star_indicator,
	red_dot_indicator,
	prev_channel_offline, // last visited channel
	curr_channel_offline // currently visiting channel
] = [];

let ac = new AbortController();
let clicks_since_mouse_enter = 0;

const sidebar_mo = new MutationObserver((mutations) => {
	const sidebar = document.querySelector(".side-bar-contents").children[0].children[0];
	followed_channels_section = sidebar.querySelector('.side-nav-section[role="group"]');
	if (followed_channels_section) {
		sidebar_mo.disconnect();

		favorite_channels_section = followed_channels_section.cloneNode(true);
		favorite_channels_section.setAttribute("aria-label", "Favorite Channels");
		const section_header = favorite_channels_section.querySelector(".side-nav-header > .side-nav-header-text > h2") || favorite_channels_section.querySelector(".side-nav-header > h2");
		section_header.innerHTML = "FAVORITE CHANNELS";
		favorite_channels_list = favorite_channels_section.querySelector(".tw-transition-group");
		favorite_channels_list.innerHTML = "";
		const show_more_less_btns_container = favorite_channels_section.querySelector(".side-nav-show-more-toggle__button");
		(show_more_less_btns_container ? show_more_less_btns_container.remove() : null);
		sidebar.prepend(favorite_channels_section);

		star_indicator = create_element_from_html_string(`
			<span class="star_indicator">⭐</span>
		`);
		red_dot_indicator = document.querySelector(".tw-channel-status-indicator");
		
		cycle_update_channels_lists();
	}
});

const channel_mo = new MutationObserver((mutations) => {
	const customize_channel_btn = document.querySelector('[href^="https://dashboard.twitch.tv/u/"][href$="/settings/channel"]');
	const follow_btn = document.querySelector('[data-a-target="follow-button"]');
	const unfollow_btn = document.querySelector('[data-a-target="unfollow-button"]');
	if (customize_channel_btn || follow_btn || unfollow_btn) {
		channel_mo.disconnect();
		remove_star_btn();

		prev_channel_offline = curr_channel_offline;
		// console.log(`last channel offline (${prev_channel_offline})`);
		curr_channel_offline = (document.querySelector(".home") ? true : false);
		// console.log(`current channel offline (${curr_channel_offline})`);
		
		if (unfollow_btn) {
			if (prev_channel_offline && !curr_channel_offline) {
				let timeout_id = null;

				const btns_section = document.querySelector('[data-target="channel-header-right"]');
				const btns_section_mo = new MutationObserver((mutations) => {
					for (const mutation of mutations) {
						for (const node of mutation.removedNodes) {
							if (node.contains(btns_section)) {
								console.log("ttv replaced btns_section");
								btns_section_mo.disconnect();
								clearTimeout(timeout_id);

								add_margin_to_squad_mode_btn();
								add_star_btn();
							}
						}
					}
				});
				btns_section_mo.observe(document.body, {
					attributes: false,
					childList: true,
					subtree: true
				});

				timeout_id = setTimeout(() => {
					console.log("timed out");
					btns_section_mo.disconnect();

					add_margin_to_squad_mode_btn();
					add_star_btn();
				}, 2500);
			} else {
				add_margin_to_squad_mode_btn();
				add_star_btn();
			}
		}
	}
});

const debounced_modify_followed_channels_list = create_debounced_function(() => {
	for (const channel of followed_channels_list.children) {
		channel.classList.add("list_channel");

		const channel_live = (channel.querySelector("span").innerHTML == "Offline" ? false : true);
		if (channel_live) {
			const channel_name = channel.querySelector('p[data-a-target="side-nav-title"]').title.split(" ")[0];
			(favorites.has(channel_name) ? apply_settings_to_channel(channel, "followed") : remove_applied_settings_from_channel(channel));
		}
	}
}, 50);
const followed_channels_list_mo = new MutationObserver((mutations) => {
	debounced_modify_followed_channels_list();
});

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

function add_margin_to_squad_mode_btn() {
	const element = document.querySelector(".metadata-layout__secondary-button-spacing");
	if (element && element.hasChildNodes()) {
		const squad_mode_btn = element.children[0];
		squad_mode_btn.style.setProperty("margin", "0 0.825em 0 0");
	}
}

function remove_margin_from_squad_mode_btn() {
	const element = document.querySelector(".metadata-layout__secondary-button-spacing");
	if (element && element.hasChildNodes()) {
		const squad_mode_btn = element.children[0];
		squad_mode_btn.style.removeProperty("margin");
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

function add_star_btn() {
	const channel_name = document.querySelector("h1.tw-title").innerHTML;

	const star_btn = create_element_from_html_string(`
		<button id="star_btn" class="${"btn_" + theme}" type="button">${(favorites.has(channel_name) ? "★" : "☆")}</button>
	`);

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

	const btns_section = document.querySelector('[data-target="channel-header-right"]');
	btns_section.prepend(star_btn);
}

function remove_star_btn() {
	const star_btn = document.querySelector("#star_btn");
	(star_btn ? star_btn.remove() : null);
}

function refresh_star_btn() {
	remove_star_btn();
	add_star_btn();
}

function expand_followed_channels_list() {
	let show_more_btn = followed_channels_section.querySelector('[data-a-target="side-nav-show-more-button"]');
	let last_element = [...(followed_channels_list.children)].at(-1); // the last element of followed_channels_list
	let last_element_live = (last_element.querySelector("span").innerHTML == "Offline" ? false : true); // whether the CHANNEL corresponding w last_element is live or not

	let show_more_times_clicked = 0;
	while (show_more_btn && last_element_live) {
		show_more_btn.click();
		show_more_times_clicked++;
		
		show_more_btn = followed_channels_section.querySelector('[data-a-target="side-nav-show-more-button"]');
		last_element = [...(followed_channels_list.children)].at(-1);
		last_element_live = (last_element.querySelector("span").innerHTML == "Offline" ? false : true);
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
	const channel_indicator = channel.querySelector(".tw-channel-status-indicator") || channel.querySelector(".star_indicator");
	if (channel_indicator) { // not rerun
		channel_indicator.replaceWith((settings.stars == true ? star_indicator.cloneNode(true) : red_dot_indicator.cloneNode(true)));
	}

	switch (for_list) {
		case "favorite":
			channel.classList.remove("d_none"); // in case followed_channels_list_mo added class d_none to channel before it was cloned
			break;
		case "followed":
			channel.classList.toggle("d_none", settings.hide);
			break;
		default:
			break;
	}
}

function remove_applied_settings_from_channel(channel) {
	const channel_indicator = channel.querySelector(".tw-channel-status-indicator") || channel.querySelector(".star_indicator");
	if (channel_indicator) { // not rerun
		channel_indicator.replaceWith(red_dot_indicator.cloneNode(true));
	}

	channel.classList.remove("d_none");
}

function configure_channel_clone(channel_clone) {
	channel_clone.classList.add("list_channel");
	apply_settings_to_channel(channel_clone, "favorite");

	const channel_clone_name = channel_clone.querySelector('p[data-a-target="side-nav-title"]').title.split(" ")[0];

	channel_clone.addEventListener("click", (evt) => { // need this for client-side routing navigation bc fsr even with deep clone, clicking on channel_clone by default does a top-level navigation
		if (evt.altKey) {
			evt.preventDefault();
			return;
		} else if (evt.shiftKey) {
			null;
		} else if (evt.ctrlKey) {
			evt.preventDefault();

			const channel_url = channel_clone.querySelector("a.side-nav-card__link.tw-link").href;
			window.open(channel_url, "_blank");
		} else {
			evt.preventDefault();
			
			const show_more_times_clicked = expand_followed_channels_list();

			for (const channel of followed_channels_list.children) {
				const channel_name = channel.querySelector('p[data-a-target="side-nav-title"]').title.split(" ")[0];
				if (channel_name == channel_clone_name) {
					const channel_anchor = channel.querySelector("a.side-nav-card__link.tw-link");
					channel_anchor.click();
					break;
				}
			}
	
			unexpand_followed_channels_list(show_more_times_clicked);
		}
	});
}

function update_channels_lists() {
	console.log("update_channels_lists started");
	
	followed_channels_list_mo.disconnect();
	followed_channels_list = followed_channels_section.querySelector(".tw-transition-group"); // need to get this per cycle bc ttv occasionally replaces followed_channels_list w a new one
	followed_channels_list_mo.observe(followed_channels_list, {
		attributes: false,
		childList: true,
		subtree: true
	});

	const show_more_times_clicked = expand_followed_channels_list();

	const num_existing_channels = favorite_channels_list.children.length;
	let num_replaced_channels = 0;
	for (const channel of followed_channels_list.children) {
		const channel_live = (channel.querySelector("span").innerHTML == "Offline" ? false : true);
		if (channel_live) {
			const channel_name = channel.querySelector('p[data-a-target="side-nav-title"]').title.split(" ")[0];
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
		const last_element = [...(favorite_channels_list.children)].at(-1);
		last_element.remove();
	}

	unexpand_followed_channels_list(show_more_times_clicked);

	if (favorite_channels_list.children.length == 0) {
		(settings.section == false ? favorite_channels_section.style.setProperty("display", "none", "important") : favorite_channels_section.style.removeProperty("display"));
	}

	console.log("update_channels_lists completed");
}
function cycle_update_channels_lists() {
	update_channels_lists();

	setInterval(() => {
		update_channels_lists();
	}, 30000);
}

async function main() {
	const logged_in = (document.querySelector('[data-a-target="login-button"]') ? false : true);
	if (!logged_in) {
		console.log("not logged in. exiting main...");
		return;
	}
	
	const synced_storage = await chrome.storage.sync.get(null);

	settings = synced_storage.settings;
	console.log(settings);

	delete synced_storage.settings;
	favorites = new Set(Object.keys(synced_storage));
	console.log(favorites);

	sidebar_mo.observe(document.body, {
		attributes: false,
		childList: true,
		subtree: true
	});

	theme = document.querySelector("html").classList[2].split("tw-root--theme-")[1];
	
	chrome.runtime.onMessage.addListener(async (msg, sender) => {
		console.log(msg);
		switch (msg.subject) {
			case "navigation":
				if (document.querySelector(".channel-root__player")) {
					console.log("channel");
	
					channel_mo.observe(document.body, {
						attributes: false,
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
					favorites = new Set(Object.keys(synced_storage));
					
					(document.querySelector("#star_btn") ? refresh_star_btn() : null);
		
					(document.querySelector("#sideNav") ? update_channels_lists() : null);
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
	
	document.body.addEventListener("click", async (evt) => {
		if (evt.target.closest('[data-a-target="follow-button"]')) {
			add_margin_to_squad_mode_btn();
			add_star_btn();
		} else if (evt.target.closest('[data-a-target="unfollow-button"]')) {
			document.body.addEventListener("click", (evt) => {
				if (evt.target.closest('[data-a-target="modal-unfollow-button"]')) {
					remove_star_btn();
					remove_margin_from_squad_mode_btn();
				}
			}, {
				once: true
			});
		}
	
		if (evt.altKey && evt.target.closest(".list_channel")) {
			evt.preventDefault();
	
			const channel = evt.target.closest(".list_channel");
			const channel_name = channel.querySelector('p[data-a-target="side-nav-title"]').title.split(" ")[0];
			try {
				(favorites.has(channel_name) ? await remove_favorite(channel_name) : await add_favorite(channel_name));
				(document.querySelector("#star_btn") ? refresh_star_btn() : null);
			} catch (err) {
				console.error(err);
			}
		}
	});

	chrome.runtime.sendMessage({
		subject: "trigger navigation",
		content: window.location.href
	}).catch((err) => null);
}

main().catch((err) => console.error(err));
