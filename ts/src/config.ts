import * as dotenv from "dotenv";
dotenv.config({ 
    path: "../.env", // ts/src から見ると ../.env になる
});
import {Sequelize, DataTypes, Op, Model} from 'sequelize';

// OptionalはSequelizeからインポートできないため、
// 自分で定義した型をそのまま使用する
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

interface QuestionAttributes {
	id: number;
	url: string;
	title?: string | null;
	body?: string | null;
	notfoundAt?: Date | null;
	postId?: number | null;
	publishedAt?: Date | null;
	miiboStatus?: number | null;
	miiboCommentedAt?: Date | null;
	createdAt?: Date; // timestamps 自動付与
	updatedAt?: Date;
}

// INSERT 時に省略できる属性を定義
type QuestionCreationAttributes = Optional<QuestionAttributes, "id" | "createdAt" | "updatedAt">;

class Question extends Model<QuestionAttributes, QuestionCreationAttributes> 
    implements QuestionAttributes {
	declare id: number;
	declare url: string;
	declare title?: string | null;
	declare body?: string | null;
	declare notfoundAt?: Date | null;
	declare postId?: number | null;
	declare publishedAt?: Date | null;
	declare miiboStatus?: number | null;
	declare miiboCommentedAt?: Date | null;
	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;
}

const sequelize = new Sequelize({
	database: 'qaai',
	username: 'fjkk',
	password: undefined,
	host: '127.0.0.1',
	dialect: 'mysql',
	timezone: '+09:00',
	logging: false
});

// const Op = Sequelize.Op;

// init でカラム定義をつける
Question.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		url: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		title: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		body: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		notfoundAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		postId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		publishedAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		miiboStatus: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		miiboCommentedAt: {
			type: DataTypes.DATE,
			allowNull: true
		}
	},
	{
		sequelize,
		modelName: "Question",
	}
);

await Question.sync();
//await Question.sync({force: true});

export {sequelize, Question, Op};