// Fixed color palette for communities - consistent across all visualizations
// Community 0 = first color, Community 1 = second color, etc.
export const COLORS = [
    "#e63946", // 0 - Red
    "#1d3557", // 1 - Navy Blue
    "#2a9d8f", // 2 - Teal
    "#f4a261", // 3 - Orange
    "#9b5de5", // 4 - Purple
    "#00b4d8", // 5 - Cyan
    "#e9c46a", // 6 - Gold
    "#06d6a0", // 7 - Green
    "#ff6b6b", // 8 - Coral
    "#4361ee", // 9 - Blue
    "#f72585", // 10 - Pink
    "#7209b7", // 11 - Violet
    "#3a0ca3", // 12 - Indigo
    "#4cc9f0", // 13 - Sky Blue
    "#80b918", // 14 - Lime
    "#ffc300", // 15 - Yellow
    "#c77dff", // 16 - Lavender
    "#2ec4b6", // 17 - Mint
    "#ff9f1c", // 18 - Amber
    "#d90429", // 19 - Crimson
    "#8338ec", // 20 - Violet 2
    "#ff006e", // 21 - Magenta
    "#fb5607", // 22 - Tangerine
    "#023e8a", // 23 - Dark Blue
    "#38b000", // 24 - Grass Green
    "#9d4edd", // 25 - Orchid
    "#48cae4", // 26 - Light Blue
    "#ffbe0b", // 27 - Sunflower
    "#e07a5f", // 28 - Salmon
    "#3d405b", // 29 - Charcoal
    "#81b29a", // 30 - Sage
    "#f2cc8f", // 31 - Peach
    "#a8dadc", // 32 - Powder Blue
    "#457b9d", // 33 - Steel Blue
    "#bc6c25", // 34 - Rust
    "#606c38", // 35 - Olive
    "#dda15e", // 36 - Camel
    "#283618", // 37 - Forest
    "#fefae0", // 38 - Cream
    "#d4a373", // 39 - Tan
    "#6b705c", // 40 - Stone
    "#a5a58d", // 41 - Khaki
    "#b7b7a4", // 42 - Taupe
    "#ccd5ae", // 43 - Sage Green
    "#e9edc9", // 44 - Light Olive
    "#faedcd", // 45 - Vanilla
    "#d5c6e0", // 46 - Lilac
    "#aaf683", // 47 - Lime Green
    "#f9c74f", // 48 - Sunny
    "#90be6d", // 49 - Fern
];

// Helper function to get consistent color for a community ID
export const getCommunityColor = (communityId: number): string => {
    return COLORS[communityId % COLORS.length];
};
