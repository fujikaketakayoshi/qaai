import {Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize({
	database: 'qaai',
	username: 'fjkk',
	password: null,
	host: '127.0.0.1',
	dialect: 'mysql',
	timezone: '+09:00',
	logging: false
});

const Op = Sequelize.Op;

const Question = sequelize.define('Question', {
	url: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	title: {
		type: DataTypes.TEXT
	},
	body: {
		type: DataTypes.TEXT
	},
	notfoundAt: {
		type: DataTypes.DATE
	},
	postId: {
		type: DataTypes.INTEGER
	},
	publishedAt: {
		type: DataTypes.DATE
	}
});

await Question.sync();
//await Question.sync({force: true});

export {sequelize, Question, Op};