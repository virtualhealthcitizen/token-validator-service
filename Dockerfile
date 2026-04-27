# Use an official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.13-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the content of the local src directory to the working directory
COPY . .

# Copy entrypoint script into the container
COPY entrypoint.sh /entrypoint.sh

# Use entrypoint script to start the service
ENTRYPOINT ["/entrypoint.sh"]
