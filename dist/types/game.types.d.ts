interface Game {
    name: string;
    is_free: boolean;
    steam_appid: number;
    controller_support: string;
    short_description: string;
    header_image: string;
    price_overview: {
        currency: string;
        final_formatted: string;
    };
    categories: {
        id: string;
        description: string;
    }[];
    background_raw: string;
}
//# sourceMappingURL=game.types.d.ts.map