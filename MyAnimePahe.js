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


(function() {
    'use strict';

	const _24hours = 1000*60*60**24;

	//Make sure to clear data (from streams) if they're not in use
	var data = GM_listValues();
	for (let index = 0; index < data.length; index++) {
		const key = data[index];
		if (key.split('/')[2] == "kwik.cx"){
			var stream = GM_getValue(key);
			if (new Date() - new Date(stream.date) > _24hours){
				GM_deleteValue(key);
			}
		}
	}

	if(location.hostname == "animepahe.com"){
		//Run code on animepahe
		animepahe();
	} else if (location.hostname == "kwik.cx"){
		//Run code on kwik (iframed video)
		kwik();
	}

	/**
	 * Main script
	 * Only runs on animepahe.com domains
	 */
	function animepahe(){
		var animes = GM_getValue('animes', {});
		
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
			}
		`);

		/**
		 * Adds an anime to the database
		 * @param {string} id The ID of the anime
		 * @param {string} name The name of the anime
		 * @param {string} thumbnail thumnnail of the anime
		 * @param {any} episodesMax 
		 */
		function addAnime(id, name, thumbnail, episodesMax = '?', episode = 0) {
			animes = GM_getValue('animes', {});
			var data = syncAjax('/api?m=release&id=' + id + '&sort=episode_asc&page=0');
			var offset = data.data[0].episode - 1;
			if(isNaN(episodesMax)){
				episodesMax = '?'
			} else {
				episodesMax = episodesMax * 1 //convert from string to either int or float
				episodesMax += offset;
			}
			animes[id] = {name: name, thumbnail: thumbnail, episodesReleased: 0, episodesMax: episodesMax, episodesSeen: episode, offset: offset};
			GM_setValue("animes", animes);
			updateReleasedEpisodes(id);
		}

		/**
		 * Removes an anime to the database
		 * @param {string} id The ID of the anime
		 */
		function removeAnime(id) {
			animes = GM_getValue('animes', {});
			delete animes[id];
			GM_setValue("animes", animes);
		}

		/**
		 * Increases the episode count by 1
		 * @param {string} id The ID of the anime
		 * @param {int} episodes the new value of episdes
		 */
		function updateEpisodes(id, episodes, allowDecrease=false) {
			//Dont update anime progress if episodesSeen is higher than new value
			animes = GM_getValue('animes', {});
			if( !allowDecrease && animes[id].episodesSeen > episodes ){
				return;
			}
			animes[id].episodesSeen = episodes;
			GM_setValue("animes", animes);
		}

		/**
		 * Detect progress in video and mark it as seen if progress passed a certain threshold
		 * @param {string} id The ID of the anime
		 */
		function checkProgress(id){
			//Get currentTime and duration of video every x seconds
		 	//Then check currentTime against duration to then check the .episode-seen checkbox
			var interval = setInterval(function(){
				var key = $('iframe.embed-responsive-item').attr('src');
				var stream = GM_getValue(key, undefined);
				
				if( stream != undefined){
					var time = stream.currentTime;
					var duration = stream.currentDuration;
					var percentage = 0.85;
					var timeReduction = 120;

					//Only run if we got a duration update
					if(duration > 0 && time > 0 ){

						//magical math
						var reducedDuration = duration - timeReduction;
						if(time/reducedDuration > percentage){
							$('.episode-seen').prop("checked", true);
							if(id in animes){
								var episodeString = $('.theatre-info h1').text().split("-")[1].split(" ")[1];
								var episodeNumber = episodeString * 1; //convert from string to either int or float
								updateEpisodes(id, episodeNumber);
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
		function updateReleasedEpisodes(animeID){
			//Don't update if released episodes == max episodes
			if( animes[animeID].episodesMax != '?' && animes[animeID].episodesReleased >= animes[animeID].episodesMax){
				return;
			}
			
			//Dont update if current date is lower than predicted next release time (minus 2 hours for margin)
			var nextUpdate = new Date(animes[animeID].predictedRelease);
			nextUpdate.setHours(nextUpdate.getHours() - 2);
			var currentDate = new Date();
			if(animes[animeID].nextUpdate && currentDate < nextUpdate){
				return;
			}

			//Get latest episode
			var data = syncAjax('/api?m=release&id=' + animeID + '&sort=episode_desc&page=0');
			var lastepisode = data.data[0];

			var lastEpisode = lastepisode.episode > lastepisode.episode2 ? lastepisode.episode : lastepisode.episode2;
			
			if(animes[animeID].episodesReleased == lastEpisode){ //There's been no new episodes
				//if current time is more than 10h over predicted releasedate then add 7 days
				var predictedRelease = new Date(animes[animeID].predictedRelease);
				var diff = currentDate - predictedRelease;
				var diffHours = diff / 3600000 ;// 1000*60*60
				if(diffHours > 10){
					predictedRelease.setDate(predictedRelease.getDate() + 7);
					animes = GM_getValue('animes', {});
					animes[animeID].predictedRelease = nextPredictedRelease;
					GM_setValue("animes", animes);
				}

			} else { //There's a new episode, update
				//Predicted next release (7 days from last one)
				var nextPredictedRelease = new Date(lastepisode.created_at);
				nextPredictedRelease.setDate(nextPredictedRelease.getDate() + 7);

				animes = GM_getValue('animes', {});
				animes[animeID].predictedRelease = nextPredictedRelease;
				animes[animeID].episodesReleased = lastEpisode;
				GM_setValue("animes", animes);
			}
		}

		/**
		 * Populates animelist by inserting the provided anime
		 * @param {string} animeID The ID of the anime
		 * @param {dict} anime The anime as a dict: {name, thumbnail, episodesSeen}
		 */
		function populateAnimeList(animeID, anime, container){

			if(anime.episodesReleased != anime.episodesMax){
				var predictedRelease = new Date(animes[animeID].predictedRelease);
				var currentDate = new Date();
				var diff = predictedRelease - currentDate;
				var timeLeft = diff / (1000*60);
				var timeLeftUnit = "min";

				if(timeLeft > 60){
					timeLeft = timeLeft / 60;
					timeLeftUnit = "h";
					
					if(timeLeft > 24){
						timeLeft = timeLeft / 24;
						timeLeftUnit = "d";
					}
				}
			}
			

			$(container).append(`
				<div class="anime-item">
					<div class="anime-item-cover">
						<img src="` + anime.thumbnail + `" alt=""></img>
						<a href="https://pahe.win/a/` + animeID + `" class="anime-cover-link"></a>
						<a class="play-next" href="https://pahe.win/a/` + animeID + `/` + (anime.episodesSeen + 1) +`">
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
								` + Math.round(timeLeft) + " " +timeLeftUnit + `
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
							`<span class="cover-released-episodes tracker-tooltip">` + anime.episodesReleased + ` 
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
			var result="";
			$.ajax({
			  url:url,
			  async: false,  
			  success:function(data) {
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
			for (let animeID in animes){
				updateReleasedEpisodes(animeID);
			}

			//Loop through every subscribed anime and add them to frontpage
			var container = $('.anime-list');
			for (let animeID in animes){
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

			//Set proper values and classes depending on if the anime is added or not
			if(id in animes){
				$('.track-button').addClass('remove-anime').text('Remove anime');
				$('input.episodes-seen').val( animes[id].episodesSeen );

				//If we previously set the total episodes to '?' (unknown) then check if it's been updated
				if(animes[id].episodesMax == '?'){
					var episodesMax = parseInt($('.anime-info strong:contains("Episodes:")')[0].nextSibling.data);
					if(!isNaN(episodesMax)){
						animes = GM_getValue('animes', {});
						episodesMax += animes[id].offset;
						animes[id].episodesMax = episodesMax;
						GM_setValue("animes", animes);
					}
				}
			} else {
				$('.track-button').addClass('add-anime').text('Track anime');
				$('.tracker-episodes').addClass('hidden');
			}

			//On click either add or remove anime from dict
			$('.track-button').click(function() {
				if($(this).hasClass("add-anime")){
					var name = $(".title-wrapper h1").text();
					var episode = parseInt( $('input.episodes-seen').val());
					var thumbnail = $(".youtube-preview").attr("href");
					var episodesMax = parseInt($('.anime-info strong:contains("Episodes:")')[0].nextSibling.data)
					addAnime(id, name, thumbnail, episodesMax, episode);
					$(this).removeClass("add-anime").addClass("remove-anime").text("Remove anime");
					$('.tracker-episodes').removeClass('hidden');
				} else {
					removeAnime(id);
					$(this).removeClass("remove-anime").addClass("add-anime").text("Track anime");
					$('.tracker-episodes').addClass('hidden');
				}
			});

			//On click increment episodes
			$('.increment-episodes').click(function() {
				var episodeNumber = parseInt( $('input.episodes-seen').val()) + 1;
				if(animes[id].offset > 0 && episodeNumber > 0 && episodeNumber < animes[id].offset + 1){
					episodeNumber = animes[id].offset + 1;
				}
				$('input.episodes-seen').val( episodeNumber );
				updateEpisodes(id, episodeNumber, true);
			});

			//On input update save episode count
			$(".episodes-seen").on("input", function(){
				var episodeNumber = parseInt( $('input.episodes-seen').val() );
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
			
			var episodeNumber = $('.theatre-info h1').text().split("-")[1].split(" ")[1];
			episodeNumber = episodeNumber * 1; // convert string to either int or float

			//Set proper values and classes depending on if the anime is added or not
			if(id in animes){
				$('.tracker-episodes').removeClass('hidden');
				if (animes[id].episodesSeen >= episodeNumber){
					$('.episode-seen').prop("checked", true);
				}
			} else {
				$('.track-button').removeClass('hidden');
			}


			//On click add anime to list
			$('.track-button').click(function() {
				var name = $(".theatre-info h1 a").text();
				var thumbnailSmall = $(".anime-poster").attr("src");
				var thumbnail = thumbnailSmall.replace('.th.', '.');
				addAnime(id, name, thumbnail, episodesMax, episodeNumber);
				$(this).addClass("hidden");
				$('.tracker-episodes').removeClass('hidden');
			});

			//Detect changes to episode-seen
			$('.episode-seen').change(function () {
				if( $(this).is(":checked") ){
					updateEpisodes(id, episodeNumber);
				}
			});

			//Detect progress in video and mark it as seen if progress passed a certain threshold
			checkProgress(id);
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
	function kwik(){
		var video = undefined;
		var url = window.location.href;

		setInterval(function(){
			if(video){
				GM_setValue(url, {currentTime: video.currentTime, currentDuration: video.duration, date: new Date()});
			} else {
				video = $("video")[0];
			}
		}, 3000);
		
	}
})();