# YTBookmarks

A powerful YouTube bookmarking extension that enhances your video watching experience with visual bookmarks, customizable settings, and easy bookmark management.

## Features

### 📌 Visual Bookmarking
- Add bookmarks with a single click using the pin button
- Visual pins on the progress bar show bookmark locations
- Pins in vibrant cyan for better visibility
- Custom labels for each bookmark

### ⚙️ Customizable Settings
- Show/Hide bookmark labels
- Auto-pause when adding bookmarks
- Toggle bookmark prompt for labels
- Quick visibility toggle to show/hide the interface
- Settings accessible via gear icon in video player

### 📋 Bookmark Management
- Draggable sidebar for easy access to all bookmarks
- Click timestamps to jump to bookmarked moments
- Edit bookmark labels anytime
- Delete individual bookmarks
- Clear all bookmarks with one click
- Undo support for deletions

### 💾 Import/Export
- Export bookmarks to JSON files
- Import bookmarks from previously exported files
- Share bookmarks across different devices

## Installation

1. Download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Navigate to any YouTube video
2. Click the 📌 button in the video player controls to add a bookmark
3. Optionally add a custom label to your bookmark
4. Access your bookmarks through the sidebar
5. Click timestamps to jump to bookmarked moments
6. Use the gear icon ⚙️ to customize settings
7. Toggle visibility with the eye icon 👁️ to show/hide the interface

## Development

The extension is built with vanilla JavaScript and uses:
- Custom CSS for styling
- YouTube's native video player API
- Local storage for saving bookmarks and settings
- MutationObserver for handling YouTube's SPA navigation

### Files
- `content.js`: Main extension logic
- `styles.css`: Custom styling
- `manifest.json`: Extension configuration
- `icon48.png`: Extension icon

## License

MIT License - Feel free to modify and distribute as needed.

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## Support

If you encounter any issues or have suggestions for improvements, please open an issue on GitHub.

