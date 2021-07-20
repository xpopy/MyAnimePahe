// ==UserScript==
// @name         MyAnimePahe 
// @namespace    MyAnimePahe
// @version      1.3
// @description  Adds anime saving and episode tracking feature to AnimePahe
// @author       Xpopy
// @match        https://animepahe.com/*
// @match        https://kwik.cx/e/*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// ==/UserScript==



/*

NOTES:
/api?m=airing&l=12&page=1
/api?m=new&id=
/api?m=release&id=' + id + '&sort=episode_asc'
/api?m=search&'
/api?m=discord

https://pahe.win/a/id/episode-number


TODO:

BREAK UP FUNCTIONS, will make it easier to read and understand

LOAD ANIMES BEFORE UPDATING, makes it feel snappier

RUN ALL UPDATING TOGETHER, instead of having 1-2 functions 

GET LATEST RELEASES USING API, and check if theres been an update there first



		function getDirectText(element) {
			let text = element.innerText;
			for (let child of element) {
				console.log(child.innerText)
				text = text.replace(child.innerText, "")
			}
			return text;
		}

		//Check if the anime is in episode list, by finding the text inside an a tag, excluding any spans
		const latestReleasesList = $('.latest-release .episode-list').children();
		for (let release of latestReleasesList) {
			const title = getDirectText($(release).find('.episode-title a'));
			if (animes[animeID].name === title) {
				//Update database
				//Find episode-number
				const episodeNumber = getDirectText($(release).find('.episode-number'));
				updateDatabase(animeID, { episodesReleased: parseFloat(episodeNumber) });
				return;
			}
		}
		
		



* replace ajax call with async
* Add a loading spin while loading all episodes
* Load episodes on home page before updating their released episodes, and then update released episodes after
* on hover on countdown show when last episode was released
* if delayed maybe show up in different colour?
*/


(function () {
	'use strict';

	//Make sure to clear data (from streams) if they're not in use
	clearStreams();

	if (location.hostname == "animepahe.com") {
		//Run code on animepahe
		animepahe();
	} else if (location.hostname == "kwik.cx") {
		//Run code on kwik (iframed video)
		kwik();
	}


	/**
	 * Clears all streams
	 */
	function clearStreams() {
		const data = GM_listValues();
		const currentDate = new Date();
		for (let index = 0; index < data.length; index++) {
			const key = data[index];
			if (key.split('/')[2] == "kwik.cx") {
				const stream = GM_getValue(key);
				if (currentDate - new Date(stream.date) > 86400000) { //24 hours = 1000*60*60*24 ms
					GM_deleteValue(key);
				}
			}
		}
	}


	/**
	 * Main script
	 * Only runs on animepahe.com domains
	 */
	function animepahe() {
		const animes = GM_getValue('animes', {});

		//Inject css
		injectCSS();

		//Run different code depending on which subPage we're in
		const urlSplits = window.location.href.split("/");
		const subPage = urlSplits[3];
		const idHash = urlSplits[4];

		if (subPage == "" || subPage.includes("?page") || subPage == "#") {	//Home page
			homePage(animes);
		} else if (subPage == "anime") {
			animePage(animes)
		} else if (subPage == "play") {
			playerPage(animes, idHash)
		}
	}

	/**
	 * Gets the currentTime and duration from a video and saves it to database for the other script to read
	 * Only runs on kwik.cx domains
	 */
	function kwik() {
		var video = undefined;
		const url = window.location.href;
		const currentDate = new Date();

		setInterval(function () {
			if (video) {
				GM_setValue(url, { currentTime: video.currentTime, currentDuration: video.duration, date: currentDate });
			} else {
				video = $("video")[0];
			}
		}, 3000);
	}


	/**
	 * All the code for the home page
	 **/
	function homePage(animes) {
		//Insert container for currently watching animes
		$('.main-header').after(`
		<section style="" class="animelist-main">
			<article>
				<div class="content-wrapper">
					<div class="tracked-animes">
						<h2>Your Animes</h2>
						<div class="anime-list-wrapper">
							<div class="anime-list row"></div>
						</div>
					</div>
				</div>
			</article>
		</section>`);

		//Update the amount of released episodes for each anime (or use cached)
		for (const animeID in animes) {
			updateReleasedEpisodes(animes[animeID]);
		}

		//Get the next episode
		for (const animeID in animes) {
			updateNextEpisode(animes[animeID]);
		}

		//Loop through every subscribed anime and add them to frontpage
		const container = $('.anime-list');
		for (const animeID in animes) {
			populateAnimeList(animes[animeID], container);
		}
	}


	/**
	 * All the code for the anime info page
	 **/
	function animePage(animes) {
		//Insert html code
		$('.anime-content').append(`
			<div id="animetracker">
				<span class="track-button"></span>
				<div class="tracker-episodes">
					Episodes: 
					<input class="episodes-seen" type="number" value="0">
					<input value="+" class="increment-episodes" type="button">
				</div> 
			</div>`
		);

		const id = $('.anime-detail').attr('class').match(/(?<=anime-)\d+/)[0];
		const episodesMax = parseFloat($('.anime-info strong:contains("Episodes:")')[0].nextSibling.data);

		//Set proper values and classes depending on if the anime is added or not
		if (id in animes) {
			const anime = animes[id];
			$('.track-button').addClass('remove-anime').text('Remove anime');
			$('input.episodes-seen').val(anime.episodesSeen);

			//If we previously set the total episodes to '?' (unknown) then check if it's been updated
			if (anime.episodesMax == '?' || !Boolean(anime.episodesMax)) {
				if (!isNaN(episodesMax)) {
					updateDatabase(anime, { episodesMax: episodesMax + anime.offset });
				}
			} else if (anime.episodesMax !== episodesMax + anime.offset) {
				updateDatabase(anime, { episodesMax: episodesMax + anime.offset });
			}

			//Check if previous thumbnail is failing, in that case fetch a new one
			var tester = new Image();
			tester.addEventListener('error', (function () {
				var thumbnail = $(".youtube-preview").attr("href");
				if (!thumbnail) {
					thumbnail = $(".poster-image").attr("href");
				}
				updateDatabase(anime, { thumbnail: thumbnail });
			}));
			tester.src = anime.thumbnail;

		} else {
			$('.track-button').addClass('add-anime').text('Track anime');
			$('.tracker-episodes').addClass('hidden');
		}

		//On click either add or remove anime from dict
		$('.track-button').click(function () {
			if ($(this).hasClass("add-anime")) {
				const name = $(".title-wrapper h1").text();
				const episode = parseFloat($('input.episodes-seen').val());
				const thumbnail = $(".youtube-preview").attr("href");
				if (!thumbnail) {
					thumbnail = $(".poster-image").attr("href");
				}
				addAnime(animes, id, name, thumbnail, episodesMax, episode);
				$(this).removeClass("add-anime").addClass("remove-anime").text("Remove anime");
				$('.tracker-episodes').removeClass('hidden');
			} else {
				removeFromDatabase(animes, animes[id]);
				$(this).removeClass("remove-anime").addClass("add-anime").text("Track anime");
				$('.tracker-episodes').addClass('hidden');
			}
		});

		//On click increment episodes
		$('.increment-episodes').click(function () {
			if (id in animes) {
				const anime = animes[id];
				var episodeNumber = parseFloat($('input.episodes-seen').val()) + 1;
				if (anime.offset > 0 && episodeNumber > 0 && episodeNumber < anime.offset + 1) {
					episodeNumber = anime.offset + 1;
				}
				$('input.episodes-seen').val(episodeNumber);
				updateEpisodes(anime, episodeNumber, true);
			}
		});

		//On input update save episode count
		$(".episodes-seen").on("input", function () {
			if (id in animes) {
				const anime = animes[id];
				const episodeNumber = parseFloat($('input.episodes-seen').val());
				updateEpisodes(anime, episodeNumber, true);
			}
		});
	}


	/**
	 * All the code for the player page
	 **/
	function playerPage(animes, idHash) {
		//Create track/remove buttons
		$('.theatre-info').append(`
			<div id="animetracker">
				<div class="track-button add-anime hidden">Track anime</div>
				<div class="tracker-episodes hidden">
					Mark as seen 
					<input class="episode-seen" type="checkbox">
				</div> 
			</div>`
		);

		const data = syncAjax('https://animepahe.com/anime/' + idHash);
		const id = data.match(/(?<=anime-)\d+/)[0];
		var episodesMax;
		try {
			episodesMax = data.match(/(?<=<\/strong> )\d+(?=<)/)[0];
		} catch (TypeError) {
			episodesMax = "?"
		}

		const episodeString = $('.theatre-info h1').text().split(" - ")[1].split(" ")[0];
		const episodeNumber = episodeString * 1; // convert string to either int or float

		//Set proper values and classes depending on if the anime is added or not
		if (id in animes) {
			$('.tracker-episodes').removeClass('hidden');
			if (animes[id].episodesSeen >= episodeNumber) {
				$('.episode-seen').prop("checked", true);
			}
		} else {
			$('.track-button').removeClass('hidden');
		}


		//On click add anime to list
		$('.track-button').click(function () {
			const name = $(".theatre-info h1 a").text();
			const thumbnailSmall = $(".anime-poster").attr("src");
			const thumbnail = thumbnailSmall.replace('.th.', '.');
			addAnime(animes, id, name, thumbnail, episodesMax, episodeNumber);
			$(this).addClass("hidden");
			$('.tracker-episodes').removeClass('hidden');
		});

		//Detect changes to episode-seen
		$('.episode-seen').change(function () {
			if ($(this).is(":checked")) {
				updateEpisodes(animes[id], episodeNumber);
			}
		});

		//Detect progress in video and mark it as seen if progress passed a certain threshold
		checkProgress(animes, id, episodeNumber);
	}


	/**
	 * Updates the database by fetching it, changing the properties and then saving it
	 * @param {string} id The ID of the anime
	 * @param {Object} args A dictionary of optional arguments with keys being the property in animes to update, and value being the value to set to the property
	 */
	function updateDatabase(anime, args = {}) {
		//Loop through every key in optional arguments and save them to the provided id
		for (const [key, value] of Object.entries(args)) {
			anime[key] = value;
		}

		const animes = GM_getValue('animes', {});
		animes[anime.id] = anime;
		GM_setValue("animes", animes);
	}


	/**
	 * Removes an anime from the database
	 * @param {string} id The ID of the anime
	 */
	function removeFromDatabase(animes, anime) {
		animes = GM_getValue('animes', {});
		const id = anime.id;
		if (id in animes) {
			delete animes[id];
			GM_setValue("animes", animes);
		}
	}


	/**
	 * Adds an anime to the database
	 * @param {string} id The ID of the anime
	 * @param {string} name The name of the anime
	 * @param {string} thumbnail thumnnail of the anime
	 * @param {any} episodesMax 
	 */
	function addAnime(animes, id, name, thumbnail, episodesMax = '?', episode = 0) {
		//Get released episodes sorted by ascending to get the first episode to get the offset
		const data = syncAjax('/api?m=release&id=' + id + '&sort=episode_asc&page=0');
		var offset = 0;

		//If there's no episodes released, data.data will be undefined, so only access it if it exists
		if (data.data) {
			offset = data.data[0].episode - 1;
		}

		//episodesMax could possibly be a string or not a number, in those cases set it to '?'
		if (isNaN(episodesMax)) {
			episodesMax = '?'
		} else {
			episodesMax = episodesMax * 1 //convert from string to either int or float
			episodesMax += offset;
		}

		//Add anime to database
		const anime = { id: id };
		animes[id] = anime;

		//Add anime to database
		updateDatabase(anime, { name: name, thumbnail: thumbnail, episodesReleased: 0, episodesMax: episodesMax, episodesSeen: episode, offset: offset })

		//Don't check for released episodes if there are none
		if (data.data) {
			updateReleasedEpisodes(anime, id);
		}
	}


	/**
	 * Updates the episodes seen count
	 * @param {string} id The ID of the anime
	 * @param {int} episodes the new value of episdes
	 */
	function updateEpisodes(anime, episodes, allowDecrease = false) {
		//Dont update anime progress if episodesSeen is higher than new value
		if (!allowDecrease && anime.episodesSeen > episodes) {
			return;
		}
		if (anime.episodesSeen > episodes) {
			updateDatabase(anime, { episodesSeen: episodes, restartPaginator: true });
		} else {
			updateDatabase(anime, { episodesSeen: episodes });
		}
	}

	/**
	 * Fetches the next episode number using API
	 */
	function updateNextEpisode(anime) {
		if (anime.episodesSeen >= anime.nextEpisode || anime?.restartPaginator) {
			if (anime?.restartPaginator) {
				anime.paginator = 1
			}
			const [nextEpisode, currentPage] = getNextEpisode(anime.animeID, anime.episodesSeen, anime.paginator);
			updateDatabase(anime, { nextEpisode: nextEpisode, paginator: currentPage, restartPaginator: false });
		}
	}


	/**
	 * Fetches the next episode number using API
	 * @param {string} id The ID of the anime
	 * @param {int} episode current episode
	 */
	function getNextEpisode(id, episode, page = 1) {
		for (; true; page++) {
			const dataPage = syncAjax('/api?m=release&id=' + id + '&sort=episode_asc&page=' + page);
			const index = dataPage.data.findIndex(item => item.episode > episode);

			if (index > -1) {
				return [dataPage.data[index].episode, page];
			}

			if (dataPage.last_page === page) {
				return [episode + 1, page];
			}
		}
	}


	/**
	 * Updates the amount of released episodes for the given anime
	 * @param {string} animeID The ID of the anime
	 */
	function updateReleasedEpisodes(anime) {
		//Don't update if released episodes == max episodes
		if (anime.episodesMax != '?' && anime.episodesReleased >= anime.episodesMax) {
			return;
		}

		//Dont update if current date is lower than predicted next release time (minus 1 hours for margin)
		const nextUpdate = new Date(anime.predictedRelease);
		const currentDate = new Date();
		currentDate.setHours(currentDate.getHours() + 1);
		if (!isNaN(nextUpdate.getTime()) && currentDate < nextUpdate) {
			//Don't skip if the episode is delayed, we will want to check more just to be sure
			if (!anime.delayed) {
				return;
			}
		}

		//Get latest episode
		var data = syncAjax('/api?m=release&id=' + anime.id + '&sort=episode_desc&page=0');

		//there's a chance there is no episodes out yet, in those cases 
		if (!data.data) {
			//Don't check again for an hour, dont wannt stress the API
			const nextPredictedRelease = new Date();
			nextPredictedRelease.setHours(nextPredictedRelease.getHours() + 7);
			updateDatabase(anime, { predictedRelease: nextPredictedRelease });
			return;
		}

		//Get last epsiode
		const lastEpisodeData = data.data[0];
		const lastEpisode = lastEpisodeData.episode > lastEpisodeData.episode2 ? lastEpisodeData.episode : lastEpisodeData.episode2;

		//Check if there's a new episode
		if (anime.episodesReleased == lastEpisode) {
			//There's been no new episodes
			const predictedRelease = new Date(anime.predictedRelease);
			const diff = currentDate - predictedRelease;
			const diffHours = diff / 3600000;// 1000*60*60

			if (diffHours > 10) {
				//if current time is 10h over predicted releasedate then add 7 days
				predictedRelease.setDate(predictedRelease.getDate() + 7);
				// delayed = 2 means it's delayed over 10 hours
				updateDatabase(anime, { predictedRelease: predictedRelease, delayed: 2 });

			} else if (diffHours > 0) {
				//if current time is over predicted releasedate then add delayed
				updateDatabase(anime, { delayed: 1 });
			}

		} else {
			//There's a new episode, update
			//If we're on previously 0 released episodes, check if the new episodes is offset
			if (anime.episodesReleased == 0 && lastEpisode > 1) {

				//Check for first episode
				const dataAsc = syncAjax('/api?m=release&id=' + anime.id + '&sort=episode_asc&page=0');
				const offset = dataAsc.data[0].episode - 1;

				if (!isNaN(anime.episodesMax)) {
					//If we previously set episodesMax, then update it with the new offset
					updateDatabase(anime, { offset: offset, episodesMax: anime.episodesMax + offset });
				} else {
					updateDatabase(anime, { offset: offset });
				}
			}

			//Predicted next release (7 days from last one)
			const nextPredictedRelease = new Date(lastEpisodeData.created_at);
			nextPredictedRelease.setDate(nextPredictedRelease.getDate() + 7);

			updateDatabase(anime, { predictedRelease: nextPredictedRelease, episodesReleased: lastEpisode, delayed: 0 });
		}
	}


	/**
	 * Populates animelist by inserting the provided anime
	 * @param {string} animeID The ID of the anime
	 * @param {dict} anime The anime as a dict: {name, thumbnail, episodesSeen}
	 */
	function populateAnimeList(anime, container) {
		var time = '';
		if (anime.episodesReleased == 0) {
			//There's been no released episodes so we don't know when it will start airing
			time = '?';
		} else {
			if (anime.episodesReleased != anime.episodesMax) {
				const predictedRelease = new Date(anime.predictedRelease);
				const currentDate = new Date();
				const diff = predictedRelease - currentDate;
				var timeLeft = diff / 60000; // 1m
				var timeLeftUnit = "min";

				if (timeLeft > 60) {
					timeLeft = timeLeft / 60;
					timeLeftUnit = "h";

					if (timeLeft > 24) {
						timeLeft = timeLeft / 24;
						timeLeftUnit = "d";
					}
				}
			}
			switch (anime.delayed) {
				case 1:
					time += '<i>soon</i>'
					break;
				case 0:
				case 2:
				default:
					//if .delayed is set to 0, 2 or undefined then display time normally
					time += Math.round(timeLeft) + " " + timeLeftUnit;
					break;
			}
		}

		$(container).append(`
			<div class="anime-item">
				<div class="anime-item-cover">
					<img src="` + anime.thumbnail + `" alt=""></img>
					<a href="https://pahe.win/a/` + anime.id + `" class="anime-cover-link"></a>
					<a class="play-next" href="https://pahe.win/a/` + anime.id + `/` + (anime.nextEpisode) + `">
						<clippath>
							<svg class="play-button" viewBox="0 0 200 200" alt="Play Video">
								<circle cx="100" cy="100" r="90" fill="none" stroke-width="15" stroke="#fff"></circle>
								<polygon points="70, 55 70, 145 145, 100" fill="#fff"></polygon>
							</svg>
						</clippath>
					</a>
					` +
			(anime.episodesReleased == anime.episodesMax ? "" : `
					<div class="triangle"></div>
						<div class="countdown-container"> <span class="countdown-next-release tracker-tooltip">
							` + time + ` 
							<span class="tooltiptext">Predicted next episode</span>
						</span>
					</div>
					`) + `
				</div>
				<div class="anime-text-container">
					<div class="episode-container">
						<span class="cover-seen-episodes tracker-tooltip">` + anime.episodesSeen + `
							<span class="tooltiptext">Seen</span>
						</span>
						/ ` +
			(anime.episodesReleased == anime.episodesMax ? "" :
				`<span class="cover-released-episodes tracker-tooltip ` + (anime.episodesReleased > anime.episodesSeen ? "new-episodes-color" : "") + `">` + anime.episodesReleased + ` 
							<span class="tooltiptext">Released</span>
						</span>
						/ `) +
			`<span class="cover-max-episodes tracker-tooltip">` + anime.episodesMax + ` 
							<span class="tooltiptext">Total</span>
						</span>
					</div>
					<a href="https://pahe.win/a/` + anime.id + `" class="anime-link">` + anime.name + `</a>
				</div>
			</div>
		`);
	}


	/**
	 * Detect progress in video and mark it as seen if progress passed a certain threshold
	 * @param {string} id The ID of the anime
	 */
	function checkProgress(animes, id, episode) {
		//Get currentTime and duration of video every x seconds
		//Then check currentTime against duration to then check the .episode-seen checkbox
		const interval = setInterval(function () {
			if (id in animes === false) {
				return;
			}

			const key = $('iframe.embed-responsive-item').attr('src');
			const stream = GM_getValue(key, undefined);

			if (stream === undefined) {
				return;
			}

			const time = stream.currentTime;
			const duration = stream.currentDuration;
			const percentage = 0.85;
			const timeReduction = 120;

			//Only run if we got a duration update
			if (!(duration > 0 && time > 0)) {
				return
			}

			//magical math
			const reducedDuration = duration - timeReduction;
			if (time / reducedDuration < percentage) {
				return;
			}

			$('.episode-seen').prop("checked", true);
			updateEpisodes(animes[id], episode);

			clearInterval(interval);	//stop interval
		}, 3000); //Run every 3 seconds
	}


	/**
	 * Send an http request to the anime/id and returnt he data
	 */
	function syncAjax(url) {
		var result = "";
		$.ajax({
			url: url,
			async: false,
			success: function (data) {
				result = data;
			}
		});
		return result;
	}


	/**
	 * Inject CSS into head
	 * @param {string} styleString A string of CSS styles to be added
	 */
	function injectCSS() {
		const styleString = `
			.theatre-info > #animetracker {
				height: 25px;
				width: auto;
				position: absolute;
				top: 15px;
				right: 0px;
			}
			.anime-content > #animetracker {
				height: 25px;
				width: auto;
				position: absolute;
				top: 210px;
			}
			#animetracker .track-button {
				padding: 2px;
				padding-left: 5px;
				padding-right: 5px;
				border-radius: 4px;
				opacity: 0.7;
			}
			#animetracker .track-button:hover {
				opacity:1;
				cursor: pointer;
			}
			#animetracker .add-anime {
				background: #083c00;
			}
			#animetracker .remove-anime {
				background: #2b2b2b;
			}
			#animetracker .remove-anime:hover {
				background: #710a0a
			}
			.tracker-episodes {
				padding: 3px;
				margin-left: 3px;
			}
			.hidden {
				display:none;
			}
			/* Tooltip container */
			.tracker-tooltip {
				position: relative;
				display: inline-block;
			}
			/* Tooltip text */
			.tracker-tooltip .tooltiptext {
				visibility: hidden;
				color: #fff;
				text-align: center;
				border-radius: 6px;
				position: absolute;
				z-index: 1;
				background: #000;
				padding: 0px 7px 2px 7px;
			}
			/* Show the tooltip text when you mouse over the tooltip container */
			.tracker-tooltip:hover .tooltiptext {
				visibility: visible;	
			}
			/* Position the tooltip text - see examples below! */
			.tracker-tooltip .tooltiptext {
				bottom: 110%;
				left: 50%;
				transform: translatex(-50%);
			}
			/* Chrome, Safari, Edge, Opera */
			input.episodes-seen::-webkit-outer-spin-button,
			input.episodes-seen::-webkit-inner-spin-button {
				-webkit-appearance: none;
				margin: 0;
			}
			/* Firefox */
			input.episodes-seen[type=number] {
				-moz-appearance: textfield;
			}
			.episodes-seen {
				background: #0000;
				color: white;
				border: 0;
				padding: 0px 5px;
				width: 39px;
				margin-left: 2px;
				text-align: right;
			}
			.increment-episodes {
				border: none;
				padding: 4px;
				line-height: 10px;
				background-color: transparent;
				color: white;
			}
			.animelist-overlay {
				position: absolute;
				width: 100%;
				height: 100%;
				background: #00000073;
				z-index: 200;
				visibility: hidden;
				text-align: center;
			}
			.animelist-container {
				position: relative;
				padding: 100px;
				height: 100%;
				max-width: 1100px;
				display: inline-block;
				width: 100%;
			}
			section.animelist-main .content-wrapper .tracked-animes{
				position: relative;
				max-width: 1100px;
				min-height: 240px;
				margin: 25px auto 20px;
			}
			section.animelist-main .content-wrapper .tracked-animes h2 {
				margin-bottom: 15px;
				font-weight: 300;
			}
			section.animelist-main .content-wrapper .anime-list-wrapper {
				position: relative;
				max-width: 1100px;
				margin: 0 auto;
			}
			section.animelist-main .content-wrapper .anime-list-wrapper .anime-list {
				position: relative;
				margin: 0 0 30px;
				min-height: 240px;
				/*justify-content: center;*/
			}
			section.animelist-main .content-wrapper .anime-list.row:empty::after {
				content: "You aren't tracking any series! Track an anime to see it here";
			}
			.anime-item {
				width: 161px;
				margin-right: 11px;
				margin-left: 11px;
				margin-bottom: 22px;
				position: relative;
				overflow: hidden;
			}
			.anime-cover-link {
				height: 100%;
				width: 100%;
				position: absolute;
				left: 0;
				background: linear-gradient(0deg, rgba(0, 0, 0, 0.7) 30%, rgba(255,255,255,0) 50%);
			}
			.anime-item img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				transform: scale(1.1);
				transition: transform 0.3s;
				-webkit-backface-visibility: hidden;
			}
			.anime-item:hover img {
				transform: scale(1.2);
			}
			.anime-item-cover{
				position: relative;
				width: 100%;
				height: 100%;
			}
			.anime-item .play-next{
				position: absolute;
				top: 0;
				bottom: 80px;
				left: 0;
				right: 0;
				filter: drop-shadow(black 0px 0px 15px);
				opacity: 0;
				transition: opacity 0.4s;
				margin: 25px;
			}
			.anime-item:hover .play-next {
				opacity: 0.5;
			}
			.play-next:hover {
				opacity: 1 !important;
			}
			.anime-item .play-next .play-button{
				padding: 20px;
				box-sizing: content-box;
			}
			.anime-item .countdown-next-release {
				text-shadow: 0 0 4px black, 0 0 4px black, 0 0 4px black;
			}
			.anime-item .countdown-container {
				position: absolute;
				top: 0px;
				right: 0;
				width: 34px;
				text-align: center;
			}
			.triangle {
				width: 0;
				height: 0;
				border-top: 40px solid #0000;
				border-left: 50px solid transparent;
				position: absolute;
				top: 0;
				right: 0;
				transition: 0.4s;
			}
			.anime-item:hover .triangle {
				border-top: 50px solid #000000b0;
				border-left: 60px solid transparent;
			}
			.anime-link {
				color: white;
				font-size: 15px;
				padding-bottom: 3px;
				position: relative;
				text-shadow: 0px 0px 3px black;
				align-self: flex-end;
				overflow: hidden;
				text-overflow: ellipsis;
				-webkit-line-clamp: 2;
				display: -webkit-box;
				-webkit-box-orient: vertical;
				pointer-events: all;
			}
			.anime-text-container {
				position: absolute;
				width: 100%;
				bottom: 0;
				padding: 5px;
				height: 85px;
				display: flex;
				pointer-events: none;
			}
			.episode-container {
				position: absolute;
				right: 10px;
				top: 10px;
				text-shadow: 0px 0px 3px black;
				pointer-events: all;
				color: #ffffffba
			}
			.new-episodes-color{
				color: #00f3ff;
			}
		`;

		const styleElement = document.createElement('style');
		styleElement.textContent = styleString;
		document.head.append(styleElement);
	}
})();