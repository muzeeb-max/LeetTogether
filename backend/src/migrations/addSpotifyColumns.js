import sequelize from '../config/db.js';

const addSpotifyColumns = async () => {
  try {
    console.log('Adding Spotify columns to Users table...');
    
    // Add missing Spotify columns
    await sequelize.getQueryInterface().addColumn('Users', 'spotifyAccessToken', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true
    });
    
    await sequelize.getQueryInterface().addColumn('Users', 'spotifyRefreshToken', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true
    });
    
    await sequelize.getQueryInterface().addColumn('Users', 'spotifyTokenExpiresAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true
    });
    
    await sequelize.getQueryInterface().addColumn('Users', 'spotifyProduct', {
      type: sequelize.Sequelize.STRING,
      allowNull: true
    });
    
    await sequelize.getQueryInterface().addColumn('Users', 'spotifyUsername', {
      type: sequelize.Sequelize.STRING,
      allowNull: true
    });
    
    console.log('Spotify columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding Spotify columns:', error.message);
    process.exit(1);
  }
};

addSpotifyColumns();
