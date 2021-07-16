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

* replace ajax call with async
* Add a loading spin while loading all episodes
* Load episodes on home page before updating their released episodes, and then update released episodes after
* on hover on countdown show when last episode was released
* if delayed maybe show up in different colour?
*/


(function () {
	'use strict';

	const _24hours = 86400000; //in ms, 1000*60*60*24

	//Make sure to clear data (from streams) if they're not in use
	var data = GM_listValues();
	for (let index = 0; index < data.length; index++) {
		const key = data[index];
		if (key.split('/')[2] == "kwik.cx") {
			var stream = GM_getValue(key);
			if (new Date() - new Date(stream.date) > _24hours) {
				GM_deleteValue(key);
			}
		}
	}

	if (location.hostname == "animepahe.com") {
		//Run code on animepahe
		animepahe();
	} else if (location.hostname == "kwik.cx") {
		//Run code on kwik (iframed video)
		kwik();
	}

	/**
	 * Main script
	 * Only runs on animepahe.com domains
	 */
	function animepahe() {
		/**
		 * Inject CSS into head
		 * @param {string} styleString A string of CSS styles to be added
		 */
		function addStyle(styleString) {
			const style = document.createElement('style');
			style.textContent = styleString;
			document.head.append(style);
		}

		addStyle(`
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
		`);


		//Make sure to fetch the newset version of database
		var animes = GM_getValue('animes', {});

		/**
		 * Updates the database by fetching it, changing the properties and then saving it
		 * @param {string} id The ID of the anime
		 * @param {Object} args A dictionary of optional arguments with keys being the property in animes to update, and value being the value to set to the property
		 */
		function updateDatabase(id = null, args = {}) {
			animes = GM_getValue('animes', {});

			//Lets us call this function with no parameters to fetch an updated version of the database
			if (!id) {
				return;
			}

			//Add id to database if it doesn't exist already
			if (!animes.hasOwnProperty(id)) {
				animes[id] = {}
			}

			//Loop through every key in optional arguments and save them to the provided id
			for (const [key, value] of Object.entries(args)) {
				animes[id][key] = value;
			}

			GM_setValue("animes", animes);
		}

		/**
		 * Removes an anime from the database
		 * @param {string} id The ID of the anime
		 */
		function removeFromDatabase(id) {
			animes = GM_getValue('animes', {});
			delete animes[id];
			GM_setValue("animes", animes);
		}

		/**
		 * Adds an anime to the database
		 * @param {string} id The ID of the anime
		 * @param {string} name The name of the anime
		 * @param {string} thumbnail thumnnail of the anime
		 * @param {any} episodesMax 
		 */
		function addAnime(id, name, thumbnail, episodesMax = '?', episode = 0) {
			//Get released episodes sorted by ascending to get the first episode to get the offset
			var data = syncAjax('/api?m=release&id=' + id + '&sort=episode_asc&page=0');
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
			updateDatabase(id, { name: name, thumbnail: thumbnail, episodesReleased: 0, episodesMax: episodesMax, episodesSeen: episode, offset: offset })

			//Don't check for released episodes if there are none
			if (data.data) {
				updateReleasedEpisodes(id);
			}
		}

		/**
		 * Updates the episodes seen count
		 * @param {string} id The ID of the anime
		 * @param {int} episodes the new value of episdes
		 */
		function updateEpisodes(id, episodes, allowDecrease = false) {
			updateDatabase();
			//Dont update anime progress if episodesSeen is higher than new value
			if (!allowDecrease && animes[id].episodesSeen > episodes) {
				return;
			}
			if (animes[id].episodesSeen > episodes) {
				updateDatabase(id, { episodesSeen: episodes, restartPaginator: true });
			} else {
				updateDatabase(id, { episodesSeen: episodes });
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
		 * Fetches the next episode number using API
		 * @param {string} animeID The ID of the anime
		 * @param {dict} anime anime object
		 */
		function updateNextEpisode(animeID, anime) {
			if (anime.episodesSeen >= anime.nextEpisode || anime?.restartPaginator) {
				if (anime?.restartPaginator) {
					anime.paginator = 1
				}
				const [nextEpisode, currentPage] = getNextEpisode(animeID, anime.episodesSeen, anime.paginator);
				updateDatabase(animeID, { nextEpisode: nextEpisode, paginator: currentPage, restartPaginator: false });
			}
		}


		/**
		 * Detect progress in video and mark it as seen if progress passed a certain threshold
		 * @param {string} id The ID of the anime
		 */
		function checkProgress(id, episode) {
			//Get currentTime and duration of video every x seconds
			//Then check currentTime against duration to then check the .episode-seen checkbox
			var interval = setInterval(function () {
				var key = $('iframe.embed-responsive-item').attr('src');
				var stream = GM_getValue(key, undefined);

				if (stream != undefined) {
					var time = stream.currentTime;
					var duration = stream.currentDuration;
					var percentage = 0.85;
					var timeReduction = 120;

					//Only run if we got a duration update
					if (duration > 0 && time > 0) {

						//magical math
						var reducedDuration = duration - timeReduction;
						if (time / reducedDuration > percentage) {
							$('.episode-seen').prop("checked", true);
							if (id in animes) {
								updateEpisodes(id, episode);
							}
							clearInterval(interval);	//stop interval
						}
					}
				}
			}, 3000); //Run every 3 seconds
		}

		/**
		 * Updates the amount of released episodes for the given anime
		 * @param {string} animeID The ID of the anime
		 */
		function updateReleasedEpisodes(animeID) {

			//Don't update if released episodes == max episodes
			if (animes[animeID].episodesMax != '?' && animes[animeID].episodesReleased >= animes[animeID].episodesMax) {
				return;
			}

			//Dont update if current date is lower than predicted next release time (minus 1 hours for margin)
			var nextUpdate = new Date(animes[animeID].predictedRelease);
			var currentDate = new Date();
			currentDate.setHours(currentDate.getHours() + 1);
			if (!isNaN(nextUpdate.getTime()) && currentDate < nextUpdate) {
				//Don't skip if the episode is delayed, we will want to check more just to be sure
				if (!animes[animeID].delayed) {
					return;
				}
			}

			//Get latest episode
			var data = syncAjax('/api?m=release&id=' + animeID + '&sort=episode_desc&page=0');

			//there's a chance there is no episodes out yet, in those cases 
			if (!data.data) {
				//Don't check again for an hour, dont wannt stress the API
				var nextPredictedRelease = new Date();
				nextPredictedRelease.setHours(nextPredictedRelease.getHours() + 7);
				updateDatabase(animeID, { predictedRelease: nextPredictedRelease });
				return;
			}


			//Get last epsiode
			const lastEpisodeData = data.data[0];
			const lastEpisode = lastEpisodeData.episode > lastEpisodeData.episode2 ? lastEpisodeData.episode : lastEpisodeData.episode2;


			//Check if there's a new episode
			if (animes[animeID].episodesReleased == lastEpisode) {
				//There's been no new episodes
				var predictedRelease = new Date(animes[animeID].predictedRelease);
				var diff = currentDate - predictedRelease;
				var diffHours = diff / 3600000;// 1000*60*60

				if (diffHours > 10) {
					//if current time is 10h over predicted releasedate then add 7 days
					predictedRelease.setDate(predictedRelease.getDate() + 7);
					// delayed = 2 means it's delayed over 10 hours
					updateDatabase(animeID, { predictedRelease: predictedRelease, delayed: 2 });

				} else if (diffHours > 0) {
					//if current time is over predicted releasedate then add delayed
					updateDatabase(animeID, { delayed: 1 });
				}

			} else {
				//There's a new episode, update
				//If we're on previously 0 released episodes, check if the new episodes is offset
				if (animes[animeID].episodesReleased == 0 && lastEpisode > 1) {

					//Check for first episode
					var dataAsc = syncAjax('/api?m=release&id=' + animeID + '&sort=episode_asc&page=0');
					var offset = dataAsc.data[0].episode - 1;

					if (!isNaN(animes[animeID].episodesMax)) {
						//If we previously set episodesMax, then update it with the new offset
						updateDatabase(animeID, { offset: offset, episodesMax: animes[animeID].episodesMax + offset });
					} else {
						updateDatabase(animeID, { offset: offset });
					}
				}

				//Predicted next release (7 days from last one)
				var nextPredictedRelease = new Date(lastEpisodeData.created_at);
				nextPredictedRelease.setDate(nextPredictedRelease.getDate() + 7);

				updateDatabase(animeID, { predictedRelease: nextPredictedRelease, episodesReleased: lastEpisode, delayed: 0 });
			}
		}

		/**
		 * Populates animelist by inserting the provided anime
		 * @param {string} animeID The ID of the anime
		 * @param {dict} anime The anime as a dict: {name, thumbnail, episodesSeen}
		 */
		function populateAnimeList(animeID, anime, container) {

			var time = '';
			if (anime.episodesReleased == 0) {
				//There's been no released episodes so we don't know when it will start airing
				time = '?';
			} else {
				if (anime.episodesReleased != anime.episodesMax) {
					var predictedRelease = new Date(animes[animeID].predictedRelease);
					var currentDate = new Date();
					var diff = predictedRelease - currentDate;
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
				switch (animes[animeID].delayed) {
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
						<a href="https://pahe.win/a/` + animeID + `" class="anime-cover-link"></a>
						<a class="play-next" href="https://pahe.win/a/` + animeID + `/` + (anime.nextEpisode) + `">
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
						<a href="https://pahe.win/a/` + animeID + `" class="anime-link">` + anime.name + `</a>
					</div>
				</div>
			`);
		}

		/**
		 * Send an http request to the anime/id and returnt he data
		 * @param {string} id The hash ID of the anime 
		 **/
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
		 * All the code for the home page
		 **/
		function homePage() {
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
				updateReleasedEpisodes(animeID);
			}

			//Get the next episode
			for (const animeID in animes) {
				updateNextEpisode(animeID, animes[animeID]);
			}

			//Loop through every subscribed anime and add them to frontpage
			var container = $('.anime-list');
			for (const animeID in animes) {
				populateAnimeList(animeID, animes[animeID], container);
			}
		}

		/**
		 * All the code for the anime info page
		 **/
		function animePage() {
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

			var id = $('.anime-detail').attr('class').match(/(?<=anime-)\d+/)[0];
			var episodesMax = parseFloat($('.anime-info strong:contains("Episodes:")')[0].nextSibling.data);

			//Set proper values and classes depending on if the anime is added or not
			if (id in animes) {
				$('.track-button').addClass('remove-anime').text('Remove anime');
				$('input.episodes-seen').val(animes[id].episodesSeen);

				let offsetMax = episodesMax + animes[id].offset;
				//If we previously set the total episodes to '?' (unknown) then check if it's been updated
				if (animes[id].episodesMax == '?' || !Boolean(animes[id].episodesMax)) {
					if (!isNaN(episodesMax)) {
						updateDatabase(id, { episodesMax: episodesMax + animes[id].offset });
					}
				} else if (animes[id].episodesMax !== episodesMax + animes[id].offset) {
					updateDatabase(id, { episodesMax: episodesMax + animes[id].offset });
				}

				//Check if previous thumbnail is failing, in that case fetch a new one
				var tester = new Image();
				tester.addEventListener('error', (function () {
					var thumbnail = $(".youtube-preview").attr("href");
					if (!thumbnail) {
						thumbnail = $(".poster-image").attr("href");
					}
					updateDatabase(id, { thumbnail: thumbnail });
				}));
				tester.src = animes[id].thumbnail;

			} else {
				$('.track-button').addClass('add-anime').text('Track anime');
				$('.tracker-episodes').addClass('hidden');
			}

			//On click either add or remove anime from dict
			$('.track-button').click(function () {
				if ($(this).hasClass("add-anime")) {
					var name = $(".title-wrapper h1").text();
					var episode = parseFloat($('input.episodes-seen').val());
					var thumbnail = $(".youtube-preview").attr("href");
					if (!thumbnail) {
						thumbnail = $(".poster-image").attr("href");
					}
					addAnime(id, name, thumbnail, episodesMax, episode);
					$(this).removeClass("add-anime").addClass("remove-anime").text("Remove anime");
					$('.tracker-episodes').removeClass('hidden');
				} else {
					removeFromDatabase(id);
					$(this).removeClass("remove-anime").addClass("add-anime").text("Track anime");
					$('.tracker-episodes').addClass('hidden');
				}
			});

			//On click increment episodes
			$('.increment-episodes').click(function () {
				var episodeNumber = parseFloat($('input.episodes-seen').val()) + 1;
				if (animes[id].offset > 0 && episodeNumber > 0 && episodeNumber < animes[id].offset + 1) {
					episodeNumber = animes[id].offset + 1;
				}
				$('input.episodes-seen').val(episodeNumber);
				updateEpisodes(id, episodeNumber, true);
			});

			//On input update save episode count
			$(".episodes-seen").on("input", function () {
				var episodeNumber = parseFloat($('input.episodes-seen').val());
				updateEpisodes(id, episodeNumber, true);
			});
		}

		/**
		 * All the code for the player page
		 **/
		function playerPage(idHash) {
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

			var data = syncAjax('https://animepahe.com/anime/' + idHash);
			var id = data.match(/(?<=anime-)\d+/)[0];
			try {
				var episodesMax = data.match(/(?<=<\/strong> )\d+(?=<)/)[0];
			} catch (TypeError) {
				var episodesMax = "?"
			}

			var episodeNumber = $('.theatre-info h1').text().split(" - ")[1].split(" ")[0];
			episodeNumber = episodeNumber * 1; // convert string to either int or float

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
				var name = $(".theatre-info h1 a").text();
				var thumbnailSmall = $(".anime-poster").attr("src");
				var thumbnail = thumbnailSmall.replace('.th.', '.');
				addAnime(id, name, thumbnail, episodesMax, episodeNumber);
				$(this).addClass("hidden");
				$('.tracker-episodes').removeClass('hidden');
			});

			//Detect changes to episode-seen
			$('.episode-seen').change(function () {
				if ($(this).is(":checked")) {
					updateEpisodes(id, episodeNumber);
				}
			});

			//Detect progress in video and mark it as seen if progress passed a certain threshold
			checkProgress(id, episodeNumber);
		}

		//Get url location
		var urlSplits = window.location.href.split("/");
		var subPage = urlSplits[3];
		var idHash = urlSplits[4];

		//Run different code depending on which subPage we're in
		if (subPage == "" || subPage.includes("?page") || subPage == "#") {	//Home page
			homePage();
		} else if (subPage == "anime") {
			animePage()
		} else if (subPage == "play") {
			playerPage(idHash)
		}
	}

	/**
	 * Gets the currentTime and duration from a video and saves it to database for the other script to read
	 * Only runs on kwik.cx domains
	 */
	function kwik() {
		var video = undefined;
		var url = window.location.href;

		setInterval(function () {
			if (video) {
				GM_setValue(url, { currentTime: video.currentTime, currentDuration: video.duration, date: new Date() });
			} else {
				video = $("video")[0];
			}
		}, 3000);

	}
})();