/* global describe, context, it, beforeEach, afterEach, should */
const Video = require('./../src/js/video');
const brightcoveResponse1 = require('./fixtures/brightcove-1.json');
const brightcoveResponse2 = require('./fixtures/brightcove-2.json');
const sinon = require('sinon/pkg/sinon');

describe('Video', () => {

	let containerEl;

	beforeEach(() => {
		containerEl = document.createElement('div');
		containerEl.setAttribute('data-o-component', 'o-video');
		containerEl.setAttribute('data-o-video-id', '4084879507001');
		containerEl.setAttribute('data-o-video-autorender', 'false');
		document.body.appendChild(containerEl);
	});

	afterEach(() => {
		document.body.removeChild(containerEl);
	});

	describe('constructor', () => {
		it('should be able to instantiate', () => {
			const video = new Video(containerEl);
			video.should.be.an.instanceOf(Video);

			video.opts.should.exist;
			video.opts.id.should.eql(4084879507001);

			video.targeting.should.exist;
			video.targeting.site.should.eql('/5887/ft.com');
			video.targeting.position.should.eql('video');
			video.targeting.sizes.should.eql('592x333|400x225');
			video.targeting.videoId.should.eql(4084879507001);

			video.containerEl.should.eql(containerEl);
			video.containerEl.hasAttribute('data-o-video-js').should.be.true;
		});

		it('should set default options', () => {
			const video = new Video(containerEl);

			video.opts.advertising.should.eql(false);
			video.opts.allProgress.should.eql(false);
			video.opts.classes.should.be.an.instanceOf(Array);
			video.opts.classes.should.contain('o-video__video');
			should.equal(video.opts.optimumwidth, null);
			video.opts.placeholder.should.eql(false);
			video.opts.playsinline.should.eql(false);
			should.equal(video.opts.data, null);
		});

		it('should allow setting options through attribute', () => {
			containerEl.setAttribute('data-o-video-optimumwidth', 300);
			containerEl.setAttribute('data-o-video-placeholder', true);
			containerEl.setAttribute('data-o-video-classes', 'a-class another-class');
			containerEl.setAttribute('data-o-video-captions-url', 'https://foo.com/a.vtt');

			const video = new Video(containerEl);
			video.opts.optimumwidth.should.eql(300);
			video.opts.placeholder.should.eql(true);
			video.opts.classes.should.contain('a-class');
			video.opts.classes.should.contain('another-class');
			video.opts.captionsUrl.should.eql('https://foo.com/a.vtt');
		});
	});

	describe('#init', () => {
		it('should return an array of video instances', () => {
			const videos = Video.init();
			videos.length.should.eql(1);
			videos[0].should.be.an.instanceOf(Video);
		});

		it('should create Video objects only once', () => {
			const videos = Video.init();
			videos.length.should.eql(1);
			const videos2 = Video.init();
			videos2.length.should.eql(0);
		});
	});

	describe('#addVideo', () => {
		it('should add a video element', () => {
			const video = new Video(containerEl);
			video.rendition = {
				url: 'http://url.mock'
			};
			video.posterImage = 'mockimage';
			video.addVideo();

			video.videoEl.should.be.an.instanceOf(HTMLElement);
			video.videoEl.parentElement.should.equal(containerEl);
			video.videoEl.poster.should.include('mockimage');
			video.videoEl.src.should.equal('http://url.mock/');
			video.videoEl.controls.should.equal(true);
			video.videoEl.hasAttribute('playsinline').should.be.false;

		});

		it('should add supplied classes to element', () => {
			const video = new Video(containerEl, {
				classes: ['class-one', 'class-two'],
				autorender: false
			});

			video.addVideo();
			video.videoEl.className.should.equal('class-one class-two o-video__video');
		});

		it('should support the playsinline option set to true', () => {
			const video = new Video(containerEl, {
				playsinline: true,
				autorender: false
			});

			video.addVideo();
			video.videoEl.hasAttribute('playsinline').should.be.true;
			video.videoEl.hasAttribute('webkit-playsinline').should.be.true;
		});

		it('should support the playsinline option set to false', () => {
			const video = new Video(containerEl, {
				playsinline: false,
				autorender: false
			});

			video.addVideo();
			video.videoEl.hasAttribute('playsinline').should.be.false;
			video.videoEl.hasAttribute('webkit-playsinline').should.be.false;
		});

		it('should set event handlers', () => {
			const video = new Video(containerEl);
			const realAddEventListener = Element.prototype.addEventListener;
			const addEventListenerSpy = sinon.spy();
			Element.prototype.addEventListener = addEventListenerSpy;

			video.addVideo();
			addEventListenerSpy.alwaysCalledOn(video.videoEl).should.equal(true);
			addEventListenerSpy.calledWith('playing', video.pauseOtherVideos);
			addEventListenerSpy.calledWith('playing', video.markPlayStart);
			addEventListenerSpy.calledWith('pause', video.updateAmountWatched);
			addEventListenerSpy.calledWith('suspend', video.clearCurrentlyPlaying);
			addEventListenerSpy.calledWith('ended', video.clearCurrentlyPlaying);
			addEventListenerSpy.calledWith('play');
			addEventListenerSpy.calledWith('playing');
			addEventListenerSpy.calledWith('pause');
			addEventListenerSpy.calledWith('ended');
			addEventListenerSpy.calledWith('progress');
			addEventListenerSpy.calledWith('error');
			addEventListenerSpy.calledWith('stalled');

			Element.prototype.addEventListener = realAddEventListener;
		});

		it('should add a track element', () => {
			containerEl.setAttribute('data-o-video-captions-url', 'https://foo.com/a.vtt');
			const video = new Video(containerEl);
			video.addVideo();
			containerEl.querySelector('video > track').getAttribute('kind').should.equal('captions');
			containerEl.querySelector('video > track').getAttribute('src').should.equal('https://foo.com/a.vtt');
		});

		describe('`watched` Event', () => {

			let mochaOnbeforeunloadHandler;
			let trackingSpy;

			const createVisibilityEvent = isHidden => {
				const visibiltyEvent = new Event('oViewport.visibility');
				visibiltyEvent.detail = {
					hidden: isHidden
				};
				return visibiltyEvent;
			};

			const unloadEventName = ('onbeforeunload' in window) ? 'beforeunload' : 'unload';

			const preventPageReload = ev => ev.preventDefault();

			beforeEach(() => {
				// mocha has a 'safety' valve to not allow reloading of pages; remove its handler for now
				// https://github.com/karma-runner/karma/commit/15d80f47a227839e9b0d54aeddf49b9aa9afe8aa
				mochaOnbeforeunloadHandler = window.onbeforeunload;
				window.onbeforeunload = undefined;
				// cancel reloading of the page
				window.addEventListener(unloadEventName, preventPageReload);
				trackingSpy = sinon.spy();
				document.body.addEventListener('oTracking.event', trackingSpy);
			});

			afterEach(() => {
				window.onbeforeunload = mochaOnbeforeunloadHandler;
				window.removeEventListener(unloadEventName, preventPageReload);
				document.body.removeEventListener('oTracking.event', trackingSpy);
			});

			it('should send `watched` event on unload', () => {
				const video = new Video(containerEl);
				video.addVideo();
				video.amountWatched = 1234567;
				// allows us to set the duration (otherwise it's read only)
				video.videoEl = {
					duration: 7654.321
				};
				window.dispatchEvent(new Event(unloadEventName, { cancelable: true }));

				const eventDetail = trackingSpy.lastCall.args[0].detail;
				eventDetail.amount.should.equal(1235);
				eventDetail.amountPercentage.should.equal(16);
			});

			it('should not include time watched if tab isn’t visible (while video playing)', () => {
				const clock = sinon.useFakeTimers();
				const video = new Video(containerEl);
				video.addVideo();
				video.videoEl.dispatchEvent(new Event('playing'));
				// allows us to set read only properties
				video.videoEl = {
					duration: 200
				};
				clock.tick(7000);
				// hide tab
				window.dispatchEvent(createVisibilityEvent(true));
				// view tab
				window.dispatchEvent(createVisibilityEvent(false));
				clock.tick(3000);
				window.dispatchEvent(new Event(unloadEventName, { cancelable: true }));

				const eventDetail = trackingSpy.lastCall.args[0].detail;
				eventDetail.amount.should.equal(10);
				eventDetail.amountPercentage.should.equal(5);

				clock.restore();
			});

			it('should not include time watched if tab isn’t visible (while video paused)', () => {
				const clock = sinon.useFakeTimers();
				const video = new Video(containerEl);
				video.addVideo();
				video.videoEl.dispatchEvent(new Event('playing'));
				clock.tick(10000);
				video.videoEl.dispatchEvent(new Event('paused'));
				// // allows us to set read only properties
				video.videoEl = {
					paused: true,
					duration: 200
				};
				// hide tab
				window.dispatchEvent(createVisibilityEvent(true));
				// view tab
				window.dispatchEvent(createVisibilityEvent(false));
				// as the video is paused, this shouldn't be included in the watched total
				clock.tick(3000);
				window.dispatchEvent(new Event(unloadEventName, { cancelable: true }));

				const eventDetail = trackingSpy.lastCall.args[0].detail;
				eventDetail.amount.should.equal(10);
				eventDetail.amountPercentage.should.equal(5);

				clock.restore();
			});

		});
	});

	describe('#addPlaceholder', () => {

		const realAddVideo = Video.prototype.addVideo;
		let addVideoSpy = sinon.spy();

		beforeEach(() => {
			Video.prototype.addVideo = addVideoSpy;
		});

		afterEach(() => {
			Video.prototype.addVideo = realAddVideo;
		});

		it('should be able to create a placeholder', () => {
			const video = new Video(containerEl, {
				autorender: false,
				placeholder: true
			});

			video.videoData = {};
			video.posterImage = 'mockimage';
			video.addPlaceholder();

			video.placeholderEl.should.be.an.instanceOf(HTMLElement);
			video.placeholderEl.parentElement.should.equal(containerEl);
			video.placeholderEl.classList.contains('o-video__placeholder').should.equal(true);

			video.placeholderImageEl.should.be.an.instanceOf(HTMLImageElement);
			video.placeholderImageEl.parentElement.should.equal(video.placeholderEl);
			video.placeholderImageEl.src.should.include('mockimage');
			video.placeholderImageEl.classList.contains('o-video__placeholder-image').should.equal(true);
		});

		it('should be able to create a placeholder with an info panel', () => {
			const video = new Video(containerEl, {
				autorender: false,
				placeholder: true,
				placeholderInfo: ['title', 'description', 'duration', 'brand']
			});

			video.videoData = brightcoveResponse1;
			video.addPlaceholder();

			video.infoPanel.should.exist;

			video.infoPanel.infoEl.parentElement.should.equal(video.placeholderEl);

			video.infoPanel.titleEl.textContent.should.equal('A hated rally');
			video.infoPanel.titleEl.parentElement.should.equal(video.infoPanel.infoEl);

			video.infoPanel.descriptionEl.textContent.should.contain('John Authers explains');
			video.infoPanel.descriptionEl.parentElement.should.equal(video.infoPanel.infoEl);

			// can extract `brand:` prefixed tag
			video.infoPanel.brandEl.textContent.should.equal('Authers Note');
			video.infoPanel.brandEl.parentElement.should.equal(video.infoPanel.infoEl);

		});

		it('should be able to create a placeholder with a play button', () => {
			const realAddEventListener = Element.prototype.addEventListener;
			const addEventListenerSpy = sinon.spy();
			Element.prototype.addEventListener = addEventListenerSpy;

			const video = new Video(containerEl, {
				autorender: false,
				placeholder: true,
				placeholdertitle: true,
			});

			video.videoData = {};
			video.addPlaceholder();

			const playButtonEl = video.placeholderEl.querySelector('.o-video__play-button');
			const playButtonTextEl = playButtonEl.querySelector('.o-video__play-button-text');
			const playIconEl = playButtonEl.querySelector('.o-video__play-button-icon');

			playButtonEl.should.exist;
			playButtonTextEl.should.exist;
			playIconEl.should.exist;
			addEventListenerSpy.called.should.equal(true);
			addEventListenerSpy.calledWith('click').should.equal(true);
			addEventListenerSpy.calledOn(playButtonEl);

			Element.prototype.addEventListener = realAddEventListener;
		});
	});

	describe('#update', () => {
		beforeEach(() => {
			const res1 = new window.Response(JSON.stringify(brightcoveResponse1), {
				status: 200,
				headers: { 'Content-type': 'application/json' }
			});

			const res2 = new window.Response(JSON.stringify(brightcoveResponse2), {
				status: 200,
				headers: { 'Content-type': 'application/json' }
			});

			sinon.stub(window, 'fetch');

			window.fetch.onFirstCall().returns(Promise.resolve(res1));
			window.fetch.onSecondCall().returns(Promise.resolve(res2));

			// FF on Linux doesn't always support H264 so to avoid going 💥 on CI, stub
			sinon.stub(HTMLVideoElement.prototype, 'canPlayType').returns('maybe');
		});

		afterEach(() => {
			window.fetch.restore();
			HTMLVideoElement.prototype.canPlayType.restore();
		});

		context('when placeholder is present', () => {
			let video;

			beforeEach(() => {
				video = new Video(containerEl, {
					prop: 'old prop',
					id: '4084879507001',
					autorender: false,
					placeholder: true,
					placeholderInfo: ['title']
				});

				return video.init();
			});

			it('replaces old options with the new', () => {
				const newOpts = { prop: 'new prop', id: brightcoveResponse2.id };

				return video.update(newOpts).then(() => {
					video.opts.prop.should.equal(newOpts.prop);
					video.opts.id.should.equal(newOpts.id);
				});
			});

			it('updates the placeholder image and title', () => {
				const newOpts = { id: brightcoveResponse2.id };

				video.placeholderImageEl.src.should.include('AuthersNote-stock-market.jpg');
				video.infoPanel.titleEl.textContent.should.equal(brightcoveResponse1.name);

				return video.update(newOpts).then(() => {
					video.placeholderImageEl.src.should.include('World-Norbert-Hofer.jpg');
					video.infoPanel.titleEl.textContent.should.equal(brightcoveResponse2.name);
				});
			});
		});

		context('when video is present', () => {
			let video;

			beforeEach(() => {
				video = new Video(containerEl, {
					id: brightcoveResponse1.id,
					autorender: false,
					placeholder: false
				});

				return video.init();
			});

			it('updates the video source and poster', () => {
				const newOpts = { id: brightcoveResponse2.id };

				video.videoEl.poster.should.include('AuthersNote-stock-market.jpg');
				video.videoEl.src.should.include('A-hated-rally.mp4');

				return video.update(newOpts).then(() => {
					video.videoEl.poster.should.include('World-Norbert-Hofer.jpg');
					video.videoEl.src.should.include(brightcoveResponse2.id + '.mp4');
				});
			});
		});

		context('forces initialisation', () => {
			let video;

			beforeEach(() => {
				video = new Video(containerEl, {
					autorender: false
				});
			});

			it('will initialise if it hasn\'t done so already', () => {
				const newOpts = { id: brightcoveResponse1.id };

				sinon.spy(video, 'init');

				return video.update(newOpts).then(() => {
					sinon.assert.calledOnce(video.init);
				});
			});
		});
	});

	describe('#getProgress', () => {
		let video;

		beforeEach(() => {
			video = new Video(containerEl);
			video.videoEl = {};
		});

		afterEach(() => {
			video = undefined;
		});

		it('should return 0 if duration is not set', () => {
			video.getProgress().should.equal(0);
		});

		it('should return the progress of the video as a percentage', () => {
			video.videoEl.duration = 200;
			video.videoEl.currentTime = 50;
			video.getProgress().should.equal(25);
		});

	});

	describe('#getTrackMode', () => {

		it('should return the state of the video text track', () => {
			const video = new Video(containerEl, { captionsUrl: 'http://localhost/a.vtt' });
			video.addVideo();
			setTimeout(() => {
				video.getTrackMode().should.equal('disabled');
			}, 100);
		});

		it('should return undefined if the video has no captions', () => {
			const video = new Video(containerEl, {});
			video.addVideo();
			setTimeout(() => {
				video.getTrackMode().should.equal(undefined);
			}, 100);
		});

	});

	describe('#getDuration', () => {
		let video;

		beforeEach(() => {
			video = new Video(containerEl);
			video.videoEl = {};
		});

		afterEach(() => {
			video = undefined;
		});

		it('should return 0 if duration is not set', () => {
			video.getDuration().should.equal(0);
		});

		it('should return the duration of the video as a integer', () => {
			video.videoEl.duration = 22.46324646;
			video.getDuration().should.equal(22);
		});

	});

	describe('#getData', () => {

		let fetchStub;

		beforeEach(() => {
			fetchStub = sinon.stub(window, 'fetch');
			const res = new window.Response(JSON.stringify(brightcoveResponse1), {
				status: 200,
				headers: {
					'Content-type': 'application/json'
				}
			});
			fetchStub.returns(Promise.resolve(res));
		});

		afterEach(() => {
			fetchStub.restore();
		});

		it('should send poster through image service if optimumwidth defined', () => {
			containerEl.setAttribute('data-o-video-optimumwidth', '300');
			const video = new Video(containerEl);
			return video.getData()
				.then(() => {
					video.posterImage.should.equal(
						'https://www.ft.com/__origami/service/image/v2/images/raw/' +
						'https%3A%2F%2Fbcsecure01-a.akamaihd.net%2F13%2F47628783001%2F201502%2F2470%2F47628783001_4085962850001_MAS-VIDEO-AuthersNote-stock-market.jpg%3FpubId%3D47628783001' +
						'?source=o-video&quality=low&fit=scale-down&width=300'
					);
				});
		});
		it('should request an optimised rendition if optimumvideowidth defined', () => {
			containerEl.setAttribute('data-o-video-optimumvideowidth', '300');
			const video = new Video(containerEl);
			return video.getData()
				.then(() => {
					video.rendition.frameWidth.should.equal(400);
				});
		});

		it('should not fetch from video if full data provided in opts', () => {
			const video = new Video(containerEl, {
				data: {
					prop: 'val',
					videoStillUrl: 'abc',
					renditions: []
				},
				autorender: false
			});

			return video
				.getData()
				.then(() => {
					video.videoData.prop.should.equal('val');
					video.videoData.videoStillUrl.should.equal('abc');
					video.videoData.renditions.length.should.equal(0);
				});
		});
	});
});
