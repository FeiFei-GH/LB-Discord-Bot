### Build the Docker Image
docker build -t feifei**/lb-discord-bot:latest .

### Run the Docker Container
docker run -d --name lb-discord-bot --env-file env.list feifei**/lb-discord-bot:latest

### Verify the Container is Running
docker logs -f lb-discord-bot

### Stop and Remove the Container
docker stop lb-discord-bot
docker rm lb-discord-bot