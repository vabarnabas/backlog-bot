import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";

import dotenv from "dotenv";
import { prisma } from "./prisma";

dotenv.config();

async function getSteamGameById(appId: string) {
  const res = await fetch(
    `http://store.steampowered.com/api/appdetails?appids=${appId}`
  );
  return await res.json();
}

function createGameEmbed(game: Game) {
  return new EmbedBuilder()
    .setTitle(game.name)
    .setDescription(game.short_description)
    .setAuthor({
      name: "Backlog Bot",
      iconURL: "https://i.imgur.com/AfFp7pu.png",
      url: "https://discord.js.org",
    })
    .setThumbnail(game.header_image)
    .addFields({
      name: "Price",
      value: game.is_free ? "Free" : game.price_overview.final_formatted,
      inline: true,
    })
    .addFields({
      name: "Controller Support",
      value: game.controller_support,
      inline: true,
    })
    .setImage(game.header_image);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  {
    name: "hello",
    description: "Says hello",
  },
  {
    name: "register",
    description: "Registers you to Backlog Bot",
  },
  {
    name: "account",
    description: "Creates a test Embed",
  },
  {
    name: "steam_search",
    description: "Searches a game on Steam",
    options: [
      {
        name: "title",
        description: "The title of the game",
        type: 3,
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN as string);

try {
  client.login(process.env.TOKEN);
} catch (e) {
  console.log(e);
}

try {
  console.log("Setting up Commands");
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID as string,
      process.env.GUILD_ID as string
    ),
    { body: commands }
  );

  console.log("Commands Registered");
} catch (e) {
  console.log("Error");
}

client.on("ready", () => console.log("Ready"));

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "hello") {
    await interaction.reply(`Hello <@${interaction.user.id}>`);
  }

  if (interaction.commandName === "register") {
    const user = await prisma.user.findUnique({
      where: { userId: interaction.user.id },
    });

    if (user) {
      await interaction.reply(
        `An account for <@${interaction.user.id}> already exists.`
      );
    }

    try {
      await prisma.user.create({
        data: {
          userId: interaction.user.id,
        },
      });
      await interaction.reply(
        `Welcome <@${interaction.user.id}> to the Backlog!`
      );
    } catch (e) {}
  }

  if (interaction.commandName === "account") {
    const user = await prisma.user.findUnique({
      where: { userId: interaction.user.id },
    });

    if (!user) {
      await interaction.reply(
        `No account was foundfor <@${interaction.user.id}>.`
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(interaction.user.displayName)
      .setAuthor({
        name: "Backlog Bot",
        iconURL: "https://i.imgur.com/AfFp7pu.png",
        url: "https://discord.js.org",
      })
      .setThumbnail(
        interaction.user.displayAvatarURL({
          size: 2048,
          forceStatic: false,
          extension: "png",
        })
      )
      .addFields(
        { name: "Level", value: `${user?.level}`, inline: true },
        { name: "EXP", value: `${user?.exp} / ${user?.maxExp}`, inline: true },
        { name: "Inline field title", value: "Some value here", inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "steam_search") {
    const getAppListUrl =
      "http://api.steampowered.com/ISteamApps/GetAppList/v2";

    const res = await fetch(getAppListUrl);
    const data = (await res.json()) as any;

    const searchTerm = interaction.options.getString("title") as string;

    const appList = data.applist.apps;

    const matchingGames = appList.filter((game: any) =>
      game.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matchingGames.length > 0) {
      const createButton = (customId: string) => {
        return new ButtonBuilder()
          .setCustomId(customId)
          .setLabel("Add to Backlog")
          .setStyle(ButtonStyle.Primary);
      };

      const game = (await getSteamGameById(matchingGames[0].appid)) as any;

      await interaction.reply({
        embeds: [createGameEmbed(game[matchingGames[0].appid].data)],
        ephemeral: true,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            createButton(`add-backlog-${matchingGames[0].appid}`)
          ),
        ],
      });

      for (const game of matchingGames.slice(1, 6)) {
        try {
          const gameData = (await getSteamGameById(game.appid)) as any;

          await interaction.followUp({
            embeds: [createGameEmbed(gameData[game.appid].data)],
            ephemeral: true,
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                createButton(`add-backlog-${game.appid}`)
              ),
            ],
          });
        } catch (error) {
          console.error("Error following up with interaction:", error);
        }
      }
    } else {
      console.log("No matching games found.");
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.includes("add-backlog-")) {
    try {
      const gameRes = (await getSteamGameById(
        interaction.customId.replace("add-backlog-", "")
      )) as any;
      const gameData = gameRes[interaction.customId.replace("add-backlog-", "")]
        .data as Game;

      await prisma.backlogItem.create({
        data: {
          displayName: gameData.name,
          appId: gameData.steam_appid,
          userId: interaction.user.id,
        },
      });

      await interaction.reply(
        `You have successfully added [${gameData.name}](https://store.steampowered.com/app/${gameData.steam_appid}) to your Backlog.`
      );
    } catch {}
  }
});
