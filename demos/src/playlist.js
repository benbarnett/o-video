import Video from '../../src/js/video';

document.addEventListener("DOMContentLoaded", function() {
	const select = document.querySelector('select');
	const queue = Array.from(select.options).map(opt => opt.value);

	const player = new Video(document.querySelector('[data-o-component="o-video"]'), {
		autorender: false
	});

	const playlist = new Video.Playlist({ player, queue });

	const buttons = Array.from(document.querySelectorAll('button')).forEach(button => {
		button.onclick = function () {
			playlist[this.name]()
		};
	});

	player.containerEl.addEventListener('play', () => {
		select.options[playlist.currentIndex].selected = true;
	}, true);
});
