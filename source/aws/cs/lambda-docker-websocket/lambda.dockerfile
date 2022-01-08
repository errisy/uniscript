# Build with .Net 6.0 SDK
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS builder
WORKDIR home
COPY . .
RUN dotnet publish LambdaEntry.csproj --output build --configuration Release

# Copy artifacts to AWS Lambda Container
FROM public.ecr.aws/lambda/dotnet:6
WORKDIR /var/task
COPY --from=builder /home/build/ ./
CMD [ "LambdaEntry::LambdaEntry.Function::FunctionHandler" ]