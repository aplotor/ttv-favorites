console.log("foreground");

let [
	settings,
	favorites,

	favorite_channels_list,
	followed_channels_list,
	channel_name_wrapper,
	channel_name,
	btns_section
] = [null];

let ac = new AbortController();
let clicks_since_mouse_enter = 0;
let ctrl_key_down = false;

const star_indicator = create_element_from_html_string(`
	<span class="star_indicator">⭐</span>
`);
const red_dot_indicator = create_element_from_html_string(`
	<div class="ScChannelStatusIndicator-sc-1cf6j56-0 YbZdY tw-channel-status-indicator" data-test-selector="0"></div>
`);

const sidebar_mo = new MutationObserver(async (mutations) => {
	const element = document.getElementsByClassName("Layout-sc-nxg1ff-0 lgtHpz")[0];
	const sidebar = (element && element.children[0] && element.children[0].getAttribute("aria-label") == "Followed Channels" ? element : null);
	if (sidebar) {
		sidebar_mo.disconnect();
		
		sidebar.insertAdjacentHTML("afterbegin", `
			<div aria-label="Favorite Channels" class="Layout-sc-nxg1ff-0 bDMqsP side-nav-section" role="group">
				<div class="Layout-sc-nxg1ff-0 jLsLts side-nav-header">
					<div class="Layout-sc-nxg1ff-0 iBiTfY side-nav-header-text">
						<h5 class="CoreText-sc-cpl358-0 fOZtfX">FAVORITE CHANNELS</h5>
					</div>
				</div>
				<div id="favorite_channels_list" class="InjectLayout-sc-588ddc-0 dBaosp tw-transition-group"></div>
			</div>
		`);
		favorite_channels_list = document.getElementById("favorite_channels_list");

		cycle_update_channels_lists();
	}
});

const channel_mo = new MutationObserver((mutations) => {
	channel_name_wrapper = document.getElementsByClassName("CoreText-sc-cpl358-0 ScTitleText-sc-1gsen4-0 fWkOCC bMnEsX InjectLayout-sc-588ddc-0 gCPoAo tw-title")[0] || document.getElementsByClassName("CoreText-sc-cpl358-0 ScTitleText-sc-1gsen4-0 pASmB bMnEsX tw-title")[0]; // live or offline, respectively
	btns_section = document.getElementsByClassName("Layout-sc-nxg1ff-0 RxRoa")[0];
	if (channel_name_wrapper && btns_section) {
		channel_mo.disconnect();
		remove_star_btn();
		channel_name = channel_name_wrapper.innerHTML;

		let element = document.getElementsByClassName("ScCoreButton-sc-1qn4ixc-0 ScCoreButtonSecondary-sc-1qn4ixc-2 bhFESG jyFZFI")[0];
		const unfollow_btn = (element && element.dataset.aTarget == "unfollow-button" ? element : null);
		if (unfollow_btn) {
			add_margin_to_squad_mode_btn();
			add_star_btn().catch((err) => console.error(err));

			unfollow_btn.addEventListener("click", (evt) => {
				remove_star_btn();
			});
			document.body.addEventListener("click", (evt) => {
				(evt.target.closest('[data-a-target="unfollow-button"]') ? remove_star_btn() : null);
			});
		}

		element = document.getElementsByClassName("ScCoreButton-sc-1qn4ixc-0 ScCoreButtonPrimary-sc-1qn4ixc-1 bhFESG ksFrFH")[0];
		const follow_btn = (element && element.dataset.aTarget == "follow-button" ? element : null);
		if (follow_btn) {
			follow_btn.addEventListener("click", (evt) => {
				add_margin_to_squad_mode_btn();
				add_star_btn().catch((err) => console.error(err));
			});
		}
	}
});

const followed_channels_list_mo = new MutationObserver((mutations) => {
	for (const channel of followed_channels_list.children) {
		const channel_live = (channel.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true);
		if (channel_live) {
			const channel_name = channel.children[0].children[0].children[0].children[1].children[0].children[0].children[0].innerHTML;
			if (favorites.has(channel_name)) {
				if (settings.stars == true) {
					const red_dot_indicator = channel.children[0].children[0].children[0].children[1].children[1].children[0].children[0];
					red_dot_indicator.replaceWith(star_indicator.cloneNode(true));
				}

				// TODO fix this
				// if (settings.hide == true) {
				// 	(!channel.classList.contains("d_none") ? channel.classList.add("d_none") : null);
				// }
			} else {
				const indicator = channel.children[0].children[0].children[0].children[1].children[1].children[0].children[0];
				if (indicator.classList.contains("star_indicator")) {
					const star_indicator = indicator;
					star_indicator.replaceWith(red_dot_indicator.cloneNode(true));	
				}
			}
		}
	}
});

window.addEventListener("keydown", (evt) => {
	(evt.key == "Control" ? ctrl_key_down = true : null);
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
			switch (msg.content) {
				case "non-channel":
					break;
				case "channel":
					channel_mo.observe(document, {
						attributes: true,
						childList: true,
						subtree: true
					});
					break;
				default:
					break;
			}
			break;
		case "favorites updated":
			const synced_storage = await chrome.storage.sync.get(null);
			delete synced_storage.settings;
			favorites = new Set([...Object.keys(synced_storage)]);

			remove_star_btn();
			add_star_btn().catch((err) => console.error(err));

			update_channels_lists();
			break;
		case "favorites cleared":
			
			break;
		case "settings changed":

			break;
		default:
			break;
	}
});

function add_margin_to_squad_mode_btn() {
	const squad_mode_btn = document.getElementsByClassName("Layout-sc-nxg1ff-0 metadata-layout__secondary-button-spacing")[0];
	(squad_mode_btn ? squad_mode_btn.style.marginRight = "10px" : null);
}

async function add_star_btn() {
	btns_section.insertAdjacentHTML("afterbegin", `
		<button id="star_btn" type="button">${(favorites.has(channel_name) ? "★" : "☆")}</button>
	`);

	const star_btn = document.getElementById("star_btn");

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

		(favorites.has(channel_name) ? await remove_favorite(channel_name) : await add_favorite(channel_name));
		
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

async function add_favorite(channel_name) {
	favorites.add(channel_name);
	update_channels_lists();
	
	await chrome.storage.sync.set({
		[channel_name]: null // value doesnt matter, only need key existence
	});
	console.log(`favorited (${channel_name})`);
	chrome.runtime.sendMessage({
		subject: "favorites updated"
	});
}

async function remove_favorite(channel_name) {
	favorites.delete(channel_name);
	update_channels_lists();

	await chrome.storage.sync.remove(channel_name);
	console.log(`unfavorited (${channel_name})`);
	chrome.runtime.sendMessage({
		subject: "favorites updated"
	});
}

function update_channels_lists() {
	console.log("update_channels_lists started");
	
	followed_channels_list_mo.disconnect();
	followed_channels_list = document.getElementsByClassName("InjectLayout-sc-588ddc-0 dBaosp tw-transition-group")[1]; // need to get this per cycle bc ttv occasionally freezes the followed channels list (i.e., makes it inactive) and uses a new active one
	followed_channels_list_mo.observe(followed_channels_list, {
		attributes: false,
		childList: true,
		subtree: false
	});

	const show_more_times_clicked = expand_followed_channels_list();
	
	const num_existing_channels = favorite_channels_list.children.length;
	let num_replaced_channels = 0;
	for (const channel of followed_channels_list.children) {
		const channel_live = (channel.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true);
		if (channel_live) {
			const channel_name = channel.children[0].children[0].children[0].children[1].children[0].children[0].children[0].innerHTML;
			if (favorites.has(channel_name)) {
				setTimeout(() => { // wait for followed_channels_list_mo to apply settings before cloning
					const channel_clone = channel.cloneNode(true);
					configure_channel_clone(channel_clone);
					
					(num_replaced_channels < num_existing_channels ? favorite_channels_list.children[num_replaced_channels++].replaceWith(channel_clone) : favorite_channels_list.append(channel_clone));
				}, 50);
			}
		}
	}

	setTimeout(() => {
		const num_leftover_channels = num_existing_channels - num_replaced_channels;
		for (let i = 0; i < num_leftover_channels; i++) {
			const last_element = [...favorite_channels_list.children].at(-1);
			last_element.remove();
		}

		unexpand_followed_channels_list(show_more_times_clicked);

		console.log("update_channels_lists completed");
	}, 100);
}
function cycle_update_channels_lists() {
	update_channels_lists();

	setInterval(() => {
		update_channels_lists();
	}, 60000);
}

function expand_followed_channels_list() {
	let element = document.getElementsByClassName("ScCoreLink-sc-udwpw5-0 eBPxOh tw-link")[0];
	let show_more_btn = (element && element.dataset.aTarget == "side-nav-show-more-button" && element.parentElement.parentElement == followed_channels_list.parentElement ? element : null); // the one for followed channels
	let last_element = [...followed_channels_list.children].at(-1); // the last element of followed_channels_list
	let last_channel_live = (last_element.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true); // whether the channel corresponding w last_element is live or not

	let show_more_times_clicked = 0;
	while (show_more_btn && last_channel_live) {
		show_more_btn.click();
		show_more_times_clicked++;
		
		element = document.getElementsByClassName("ScCoreLink-sc-udwpw5-0 eBPxOh tw-link")[0];
		show_more_btn = (element && element.dataset.aTarget == "side-nav-show-more-button" && element.parentElement.parentElement == followed_channels_list.parentElement ? element : null);
		last_element = [...followed_channels_list.children].at(-1);
		last_channel_live = (last_element.children[0].children[0].children[0].children[1].children[1].children[0].innerHTML == "Offline" ? false : true);
	}
	console.log(`show more clicked (${show_more_times_clicked}) time${(show_more_times_clicked == 1 ? "" : "s")}`);

	return show_more_times_clicked;
}

function unexpand_followed_channels_list(show_more_times_clicked) {
	let show_less_times_clicked = 0;
	if (show_more_times_clicked > 0) {
		const show_less_btn = document.getElementsByClassName("ScCoreLink-sc-udwpw5-0 eBPxOh tw-link")[1]; // the one for followed channels

		for (let i = 0; i < show_more_times_clicked; i++) {
			show_less_btn.click();
			show_less_times_clicked++;
		}
	}
	console.log(`show less clicked (${show_less_times_clicked}) time${(show_less_times_clicked == 1 ? "" : "s")}`);
}

function configure_channel_clone(channel_clone) {
	(channel_clone.classList.contains("d_none") ? channel_clone.classList.remove("d_none") : null);

	const channel_clone_name = channel_clone.children[0].children[0].children[0].children[1].children[0].children[0].children[0].innerHTML;

	channel_clone.addEventListener("click", (evt) => { // need this for client-side routing bc fsr even with deep clone, clicking on channel_clone by default does a full page reload
		evt.preventDefault();

		if (ctrl_key_down) {
			const stream_url = channel_clone.children[0].children[0].children[0].href;
			window.open(stream_url, "_blank");
		} else {
			const show_more_times_clicked = expand_followed_channels_list();

			for (const channel of followed_channels_list.children) {
				const channel_name = channel.children[0].children[0].children[0].children[1].children[0].children[0].children[0].innerHTML;
				if (channel_name == channel_clone_name) {
					const stream_anchor = channel.children[0].children[0].children[0];
					stream_anchor.click();
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
